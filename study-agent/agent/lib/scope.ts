export type LessonScope = {
  userId: string;
  topicId: string;
  courseId: string;
  persona: string;
};

const asString = (value: unknown) => String(value || "").trim();

type AuthContext = {
  principalId?: string;
  principalType?: string;
  attributes?: Readonly<Record<string, string | readonly string[]>>;
} | null;

export const getLessonScope = (ctx: {
  session: {
    auth: {
      current?: AuthContext;
      initiator?: AuthContext;
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

  // Defense in depth: route auth already rejects cross-user session follow-ups.
  // Fail loud here if a mismatched caller ever reaches a tool, so a durable
  // session can never be continued by a different student.
  const initiatorId = asString(ctx.session.auth.initiator?.principalId);
  if (initiatorId && initiatorId !== userId) {
    throw new Error("This study session belongs to another student.");
  }

  return { userId, topicId, courseId, persona };
};
