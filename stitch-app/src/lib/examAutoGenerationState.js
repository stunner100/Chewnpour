export const AUTO_GENERATION_TIMEOUT_MESSAGE =
    "Question generation timed out. Tap Generate Questions to retry.";
export const AUTO_GENERATION_EXHAUSTED_MESSAGE =
    "Question generation is taking too long. Tap Generate Questions to retry.";
export const AUTO_GENERATION_ERROR_RETRY_MESSAGE =
    "Failed to generate questions. Retrying automatically...";

const toNonNegativeNumber = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
};

export const resolveAutoGenerationResult = ({
    result,
    previousQuestionCount = 0,
    attemptCount = 0,
    maxAttempts = 3,
    minExamQuestions = 1,
}) => {
    const count = toNonNegativeNumber(result?.count ?? 0);
    const safePreviousQuestionCount = toNonNegativeNumber(previousQuestionCount);
    const safeAttemptCount = toNonNegativeNumber(attemptCount);
    const safeMaxAttempts = Math.max(1, toNonNegativeNumber(maxAttempts));
    const safeMinExamQuestions = Math.max(1, toNonNegativeNumber(minExamQuestions));

    const madeProgress = count > safePreviousQuestionCount;
    const successful = Boolean(result?.success) && count > 0 && madeProgress;
    if (successful) {
        return {
            nextAttemptCount: 0,
            pauseAutoGeneration: false,
            exhaustedAutoRetries: false,
            latestQuestionCount: count,
            madeProgress,
            errorMessage: "",
        };
    }

    const nextAttemptCount = safeAttemptCount + 1;
    const exhaustedAutoRetries = nextAttemptCount >= safeMaxAttempts;

    return {
        nextAttemptCount,
        pauseAutoGeneration: exhaustedAutoRetries,
        exhaustedAutoRetries,
        latestQuestionCount: count,
        madeProgress,
        errorMessage: exhaustedAutoRetries
            ? AUTO_GENERATION_EXHAUSTED_MESSAGE
            : `Still preparing questions (${Math.min(count, safeMinExamQuestions)} of ${safeMinExamQuestions}). Retrying automatically...`,
    };
};

export const resolveAutoGenerationError = ({
    error,
    attemptCount = 0,
    maxAttempts = 3,
}) => {
    const message = String(error?.message || "");
    const timedOut = /timed out/i.test(message);
    const safeAttemptCount = toNonNegativeNumber(attemptCount);
    const safeMaxAttempts = Math.max(1, toNonNegativeNumber(maxAttempts));
    const nextAttemptCount = safeAttemptCount + 1;
    const exhaustedAutoRetries = nextAttemptCount >= safeMaxAttempts;
    const pauseAutoGeneration = timedOut || exhaustedAutoRetries;

    return {
        timedOut,
        nextAttemptCount,
        exhaustedAutoRetries,
        pauseAutoGeneration,
        errorMessage: pauseAutoGeneration
            ? AUTO_GENERATION_TIMEOUT_MESSAGE
            : AUTO_GENERATION_ERROR_RETRY_MESSAGE,
    };
};
