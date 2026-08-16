import { defineTool } from "eve/tools";
import { z } from "zod";
import { getLessonForUser, listCourseLessonsForUser } from "../lib/lessons";
import { getLessonScope } from "../lib/scope";

export default defineTool({
  description:
    "List other generated lessons in the same course. Use this when the student asks about a related lesson. Do not fetch another student's courses.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const scope = getLessonScope(ctx);
    const current = await getLessonForUser(scope.userId, scope.topicId);
    const courseId = scope.courseId || current?.courseId;
    if (!courseId) {
      return { found: false, error: "This lesson is not attached to a course." };
    }
    const lessons = await listCourseLessonsForUser(scope.userId, courseId);
    return {
      found: lessons.length > 0,
      courseId,
      currentTopicId: scope.topicId,
      lessons,
    };
  },
});
