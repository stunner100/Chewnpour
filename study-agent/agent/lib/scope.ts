export type LessonScope = {
  userId: string;
  topicId: string;
  courseId: string;
  persona: string;
};

const asString = (value: unknown) => String(value || "").trim();

export const getLessonScope = (ctx: {
  session: {
    auth: {
      current?: {
        principalId?: string;
        attributes?: Readonly<Record<string, string | readonly string[]>>;
      } | null;
    };
  };
}): LessonScope => {
  const auth = ctx.session.auth.current;
  const userId = asString(auth?.principalId);
  const attributes = auth?.attributes || {};
  const topicId = asString(attributes.topicId);
  const courseId = asString(attributes.courseId);
  const persona = asString(attributes.persona) || "coach";

  if (!userId || !topicId) {
    throw new Error("This study session is missing a signed-in student or lesson.");
  }

  return { userId, topicId, courseId, persona };
};
