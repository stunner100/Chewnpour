import { defineTool } from "eve/tools";
import { z } from "zod";
import { findLessonSection, getLessonForUser } from "../lib/lessons";
import { getLessonScope } from "../lib/scope";

export default defineTool({
  description:
    "Open one section of the student's current lesson by title or index. Use this when you need the full section, not just a search snippet.",
  inputSchema: z.object({
    title: z.string().min(1).max(200).optional(),
    index: z.number().int().min(0).max(80).optional(),
    topicId: z.string().min(1).optional(),
  }),
  async execute(input, ctx) {
    const scope = getLessonScope(ctx);
    const topicId = String(input.topicId || scope.topicId);
    const lesson = await getLessonForUser(scope.userId, topicId);
    if (!lesson) {
      return { found: false, error: "Lesson not found for this student." };
    }
    const section = findLessonSection(lesson, {
      title: input.title,
      index: input.index,
    });
    if (!section) {
      return {
        found: false,
        topicId: lesson.id,
        title: lesson.title,
        error: "No matching section in this lesson.",
      };
    }
    return {
      found: true,
      topicId: lesson.id,
      lessonTitle: lesson.title,
      section,
    };
  },
});
