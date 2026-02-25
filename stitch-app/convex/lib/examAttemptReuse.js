export const EXAM_ATTEMPT_REUSE_MAX_AGE_MS = 30 * 60 * 1000;

export const canReuseExamAttempt = ({
    attempt,
    topicId,
    examFormat,
    nowMs = Date.now(),
    maxAgeMs = EXAM_ATTEMPT_REUSE_MAX_AGE_MS,
}) => {
    if (!attempt || !topicId) return false;
    if (String(attempt.topicId || "") !== String(topicId)) return false;

    const normalizedRequestedFormat = String(examFormat || "").trim().toLowerCase();
    const normalizedAttemptFormat = String(attempt.examFormat || "").trim().toLowerCase();
    if (normalizedRequestedFormat && normalizedAttemptFormat && normalizedRequestedFormat !== normalizedAttemptFormat) {
        return false;
    }

    const questionIds = Array.isArray(attempt.questionIds) ? attempt.questionIds : [];
    if (questionIds.length === 0) return false;

    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    if (answers.length > 0) return false;

    const score = Number(attempt.score || 0);
    if (Number.isFinite(score) && score > 0) return false;

    const createdAt = Number(attempt._creationTime || 0);
    if (!Number.isFinite(createdAt) || createdAt <= 0) return false;

    const ageMs = Math.max(0, Number(nowMs || Date.now()) - createdAt);
    if (ageMs > maxAgeMs) return false;

    return true;
};

export const resolveReusableAttemptQuestions = ({
    questionIds,
    loadedQuestions,
    topicId,
}) => {
    const reusableQuestionIds = Array.isArray(questionIds) ? questionIds : [];
    const candidates = Array.isArray(loadedQuestions) ? loadedQuestions : [];
    if (reusableQuestionIds.length === 0) return [];
    if (candidates.length !== reusableQuestionIds.length) return [];

    const safeQuestions = [];
    for (let index = 0; index < reusableQuestionIds.length; index += 1) {
        const expectedQuestionId = reusableQuestionIds[index];
        const question = candidates[index];
        if (!question) {
            return [];
        }
        if (String(question._id || "") !== String(expectedQuestionId || "")) {
            return [];
        }
        if (String(question.topicId || "") !== String(topicId || "")) {
            return [];
        }
        safeQuestions.push(question);
    }

    return safeQuestions;
};
