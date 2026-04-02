import { normalizeExamFormat } from "./objectiveExam.js";
import {
    isExamSnapshotCompatible,
    resolveExamSnapshotTimestamp,
} from "./examVersioning.js";

export const canReuseExamAttempt = ({
    attempt,
    topicId,
    examFormat,
    topic,
    assessmentVersion,
}) => {
    if (!attempt || !topicId) return false;
    if (String(attempt.topicId || "") !== String(topicId)) return false;

    const normalizedRequestedFormat = normalizeExamFormat(examFormat);
    const normalizedAttemptFormat = normalizeExamFormat(attempt.examFormat);
    if (normalizedRequestedFormat && normalizedAttemptFormat && normalizedRequestedFormat !== normalizedAttemptFormat) {
        return false;
    }

    const questionIds = Array.isArray(attempt.questionIds) ? attempt.questionIds : [];
    if (questionIds.length === 0) return false;

    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    if (answers.length > 0) return false;

    const score = Number(attempt.score || 0);
    if (Number.isFinite(score) && score > 0) return false;

    // Guard: if another session already claimed this attempt, skip it
    if (attempt.claimedAt && typeof attempt.claimedAt === 'number') return false;

    if (!isExamSnapshotCompatible({
        snapshotQuestionSetVersion: attempt.questionSetVersion,
        snapshotAssessmentVersion: attempt.assessmentVersion,
        topic,
        requestedAssessmentVersion: assessmentVersion,
        snapshotAt: resolveExamSnapshotTimestamp(attempt),
    })) {
        return false;
    }

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
