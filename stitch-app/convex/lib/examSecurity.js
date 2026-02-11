export const resolveAuthUserId = (identity) => {
    if (!identity || typeof identity !== "object") return "";
    const candidates = [
        identity.subject,
        identity.userId,
        identity.id,
        identity.tokenIdentifier,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "";
};

export const assertAuthorizedUser = ({
    authUserId,
    requestedUserId,
    resourceOwnerUserId,
}) => {
    if (!authUserId) {
        throw new Error("Not authenticated");
    }
    if (requestedUserId && requestedUserId !== authUserId) {
        throw new Error("You do not have permission to access this exam data.");
    }
    if (resourceOwnerUserId && resourceOwnerUserId !== authUserId) {
        throw new Error("You do not have permission to access this exam attempt.");
    }
    return authUserId;
};

export const sanitizeExamQuestionForClient = (question) => {
    if (!question || typeof question !== "object") return question;
    const { correctAnswer, ...safeQuestion } = question;
    return safeQuestion;
};

export const computeExamPercentage = ({ score, totalQuestions, fallbackTotal = 0 }) => {
    const safeScore = Number.isFinite(score) ? Number(score) : 0;
    const safeTotal = Number.isFinite(totalQuestions) ? Number(totalQuestions) : 0;
    const safeFallback = Number.isFinite(fallbackTotal) ? Number(fallbackTotal) : 0;
    const denominator = safeTotal > 0 ? safeTotal : safeFallback > 0 ? safeFallback : 1;
    return Math.round((safeScore / denominator) * 100);
};
