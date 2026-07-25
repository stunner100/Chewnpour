/** Parked exam helpers after Convex → Supabase hard cutover. */

export const EXAM_DURATION_SECONDS = 45 * 60;
export const MIN_ESSAY_SUBMIT_CHAR_COUNT = 20;

export const isQuestionAnswered = (question, answer) => {
  if (!question) return false;
  if (answer == null) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (typeof answer === 'number') return Number.isFinite(answer);
  if (Array.isArray(answer)) return answer.length > 0;
  return Boolean(answer);
};
