const toNonNegativeInteger = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.max(0, Math.round(numeric));
};

export const resolvePreparedExamStart = ({
    requiredQuestionCount,
    selectedQuestionCount,
    requiresGeneration,
    unavailableReason,
    coverageSatisfied,
    allowPartialReady = false,
}) => {
    const safeRequiredQuestionCount = toNonNegativeInteger(requiredQuestionCount);
    const safeSelectedQuestionCount = toNonNegativeInteger(selectedQuestionCount);
    const canStartPartialAttempt = Boolean(allowPartialReady) && safeSelectedQuestionCount > 0;
    const attemptTargetCount = canStartPartialAttempt
        ? safeSelectedQuestionCount
        : safeRequiredQuestionCount;

    if (unavailableReason && !canStartPartialAttempt) {
        return {
            status: "unavailable",
            reasonCode: unavailableReason,
            attemptTargetCount,
            canStartPartialAttempt,
        };
    }

    if ((safeSelectedQuestionCount < safeRequiredQuestionCount || Boolean(requiresGeneration)) && !canStartPartialAttempt) {
        return {
            status: "needs_generation",
            reasonCode: coverageSatisfied === false
                ? "MISSING_OUTCOME_COVERAGE"
                : "INSUFFICIENT_FRESH_QUESTIONS",
            attemptTargetCount,
            canStartPartialAttempt,
        };
    }

    return {
        status: "ready",
        reasonCode: undefined,
        attemptTargetCount,
        canStartPartialAttempt,
    };
};
