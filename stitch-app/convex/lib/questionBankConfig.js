const toSafeNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const clampNumber = (value, min, max) => {
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : safeMin;
    const upperBound = safeMax >= safeMin ? safeMax : safeMin;
    const numeric = toSafeNumber(value, safeMin);
    return Math.max(safeMin, Math.min(upperBound, numeric));
};

export const calculateQuestionBankTarget = ({
    wordCount,
    minTarget = 10,
    maxTarget = 35,
    wordDivisor = 55,
}) => {
    const safeMinTarget = Math.max(1, Math.round(toSafeNumber(minTarget, 10)));
    const safeMaxTarget = Math.max(safeMinTarget, Math.round(toSafeNumber(maxTarget, 35)));
    const safeDivisor = Math.max(1, Math.round(toSafeNumber(wordDivisor, 55)));
    const safeWordCount = Math.max(0, Math.round(toSafeNumber(wordCount, 0)));
    const computed = Math.ceil(safeWordCount / safeDivisor);
    return clampNumber(computed, safeMinTarget, safeMaxTarget);
};

export const deriveQuestionGenerationRounds = ({
    targetCount,
    existingCount = 0,
    batchSize = 12,
    minRounds = 2,
    maxRounds = 10,
    bufferRounds = 2,
}) => {
    const safeTarget = Math.max(0, Math.round(toSafeNumber(targetCount, 0)));
    const safeExisting = Math.max(0, Math.round(toSafeNumber(existingCount, 0)));
    const safeBatchSize = Math.max(1, Math.round(toSafeNumber(batchSize, 12)));
    const safeMinRounds = Math.max(1, Math.round(toSafeNumber(minRounds, 2)));
    const safeMaxRounds = Math.max(safeMinRounds, Math.round(toSafeNumber(maxRounds, 10)));
    const safeBufferRounds = Math.max(0, Math.round(toSafeNumber(bufferRounds, 2)));
    const remaining = Math.max(0, safeTarget - safeExisting);
    const estimated = Math.ceil(remaining / safeBatchSize) + safeBufferRounds;
    return clampNumber(estimated, safeMinRounds, safeMaxRounds);
};

export const resolveQuestionBankProfile = (profile = {}) => {
    const minTarget = Math.max(1, Math.round(toSafeNumber(profile.minTarget, 10)));
    const maxTarget = Math.max(minTarget, Math.round(toSafeNumber(profile.maxTarget, 35)));
    const batchSize = Math.max(1, Math.round(toSafeNumber(profile.batchSize, 12)));
    const requestTimeoutMs = Math.max(1000, Math.round(toSafeNumber(profile.requestTimeoutMs, 25_000)));
    const minBatchSize = clampNumber(
        Math.round(toSafeNumber(profile.minBatchSize, Math.min(6, batchSize))),
        1,
        batchSize
    );

    return {
        minTarget,
        maxTarget,
        wordDivisor: Math.max(1, Math.round(toSafeNumber(profile.wordDivisor, 55))),
        batchSize,
        minBatchSize,
        maxBatchAttempts: Math.max(1, Math.round(toSafeNumber(profile.maxBatchAttempts, 2))),
        requestTimeoutMs,
        repairTimeoutMs: Math.max(
            1000,
            Math.round(toSafeNumber(profile.repairTimeoutMs, Math.min(8_000, requestTimeoutMs)))
        ),
        parallelRequests: Math.max(1, Math.round(toSafeNumber(profile.parallelRequests, 1))),
        minRounds: Math.max(1, Math.round(toSafeNumber(profile.minRounds, 2))),
        maxRounds: Math.max(1, Math.round(toSafeNumber(profile.maxRounds, 10))),
        bufferRounds: Math.max(0, Math.round(toSafeNumber(profile.bufferRounds, 2))),
        noProgressLimit: Math.max(1, Math.round(toSafeNumber(profile.noProgressLimit, 3))),
        timeBudgetMs: Math.max(1000, Math.round(toSafeNumber(profile.timeBudgetMs, 90_000))),
    };
};

export const QUESTION_BANK_BACKGROUND_PROFILE = resolveQuestionBankProfile({
    minTarget: 40,
    maxTarget: 60,
    wordDivisor: 55,
    batchSize: 14,
    minBatchSize: 7,
    maxBatchAttempts: 3,
    requestTimeoutMs: 60_000,
    repairTimeoutMs: 8_000,
    parallelRequests: 2,
    minRounds: 3,
    maxRounds: 12,
    bufferRounds: 3,
    noProgressLimit: 4,
    timeBudgetMs: 180_000,
});

export const QUESTION_BANK_INTERACTIVE_PROFILE = resolveQuestionBankProfile({
    minTarget: 20,
    maxTarget: 30,
    wordDivisor: 120,
    batchSize: 10,
    minBatchSize: 5,
    maxBatchAttempts: 1,
    requestTimeoutMs: 12_000,
    repairTimeoutMs: 3_000,
    parallelRequests: 2,
    minRounds: 2,
    maxRounds: 6,
    bufferRounds: 1,
    noProgressLimit: 3,
    timeBudgetMs: 60_000,
});
