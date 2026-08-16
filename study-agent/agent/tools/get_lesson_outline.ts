import { defineTool } from "eve/tools";
import { z } from "zod";
import { getLessonForUser, toOutline } from "../lib/lessons";
import { getLessonScope } from "../lib/scope";

export default defineTool({
  description:
    "Return the current lesson title, description, and section list. Use this for overviews, orientation, and choosing which section to open.",
  inputSchema: z.object({
    topicId: z.string().min(1).optional(),
  }),
  async execute(input, ctx) {
    const scope = getLessonScope(ctx);
    const topicId = String(input.topicId || scope.topicId);
    const lesson = await getLessonForUser(scope.userId, topicId);
    if (!lesson) {
      return { found: false, error: "Lesson not found for this student." };
    }
    return { found: true, outline: toOutline(lesson) };
  },
});
