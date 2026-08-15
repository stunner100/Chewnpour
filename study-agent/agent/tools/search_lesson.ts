import { defineTool } from "eve/tools";
import { z } from "zod";
import { getLessonForUser, searchLessonSections } from "../lib/lessons";
import { getLessonScope } from "../lib/scope";

export default defineTool({
  description:
    "Search the student's current lesson for passages that match a question or topic. Use this before answering content questions.",
  inputSchema: z.object({
    query: z.string().min(2).max(400),
    topicId: z
      .string()
      .min(1)
      .optional()
      .describe("Defaults to the lesson this chat is bound to."),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  async execute(input, ctx) {
    const scope = getLessonScope(ctx);
    const topicId = String(input.topicId || scope.topicId);
    const lesson = await getLessonForUser(scope.userId, topicId);
    if (!lesson) {
      return { found: false, error: "Lesson not found for this student." };
    }
    const passages = searchLessonSections(lesson, input.query, input.limit || 4);
    return {
      found: passages.length > 0,
      topicId: lesson.id,
      title: lesson.title,
      passages,
    };
  },
});
