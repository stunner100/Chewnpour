const toSafeNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const tokenizeEvidenceText = (value) =>
    String(value || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4);

const countSentenceLikeUnits = (value) =>
    String(value || "")
        .split(/(?<=[.!?])\s+|\n+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length >= 20)
        .length;

const countBulletLikeLines = (value) =>
    String(value || "")
        .split(/\n+/)
        .map((entry) => entry.trim())
        .filter((entry) => /^[-*•]\s+/.test(entry) || /^\d+[.)]\s+/.test(entry))
        .length;

const countStructuredSignals = (value) => {
    const text = String(value || "");
    const numericSignals = (text.match(/\b\d+(?:[./]\d+)?%?\b/g) || []).length;
    const definitionSignals = (text.match(/\b(is|are|means|defined as|refers to)\b/gi) || []).length;
    const exampleSignals = (text.match(/\b(example|for example|such as)\b/gi) || []).length;
    return {
        numericSignals,
        definitionSignals,
        exampleSignals,
    };
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

const normalizeTopicText = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const extractUniquePassages = (evidence) => {
    const items = Array.isArray(evidence) ? evidence : [];
    const uniquePassages = [];
    const seenPassageIds = new Set();

    for (const passage of items) {
        const fallbackId = `page:${Number(passage?.page || 0)}:${String(passage?.text || "").slice(0, 80)}`;
        const passageId = String(passage?.passageId || fallbackId).trim();
        if (!passageId || seenPassageIds.has(passageId)) {
            continue;
        }
        seenPassageIds.add(passageId);
        uniquePassages.push(passage);
    }

    return uniquePassages;
};

const resolveUniqueSourcePassageCount = (sourcePassageIds) =>
    new Set(
        (Array.isArray(sourcePassageIds) ? sourcePassageIds : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean)
    ).size;

const isBroadCatchAllTopic = ({
    topicTitle,
    topicDescription,
    sourcePassageIds,
    evidencePassageCount,
}) => {
    const title = normalizeTopicText(topicTitle);
    const description = normalizeTopicText(topicDescription);
    const strippedTitle = title.replace(/^deep dive:\s*/i, "").trim();
    const sourcePassageCount = resolveUniqueSourcePassageCount(sourcePassageIds);
    const genericPattern = /\b(overview|introduction|summary|manual|training manual|handbook|guide|document|notes|course|full)\b/;
    const genericTitle = genericPattern.test(strippedTitle);
    const deepDiveTitle = title.startsWith("deep dive:");
    const broadDescription =
        description.includes("focused exploration of")
        && (!!strippedTitle && description.includes(strippedTitle));
    const wideCoverage = Math.max(sourcePassageCount, Number(evidencePassageCount || 0)) >= 8;

    return genericTitle || (deepDiveTitle && broadDescription) || (deepDiveTitle && wideCoverage);
};

const estimateEvidencePassageQuestionCapacity = (passage) => {
    const text = String(passage?.text || "").trim();
    if (!text) return 0;

    const textLength = text.length;
    const sentenceCount = countSentenceLikeUnits(text);
    const bulletCount = countBulletLikeLines(text);
    const tokenCount = new Set(tokenizeEvidenceText(text)).size;
    const flags = Array.isArray(passage?.flags) ? passage.flags.filter(Boolean) : [];
    const { numericSignals, definitionSignals, exampleSignals } = countStructuredSignals(text);

    let capacity = 1;
    if (textLength >= 140) capacity += 1;
    if (textLength >= 260) capacity += 1;
    if (sentenceCount >= 3 || bulletCount >= 2 || definitionSignals >= 1) capacity += 1;
    if (sentenceCount >= 6 || bulletCount >= 4 || numericSignals >= 2 || exampleSignals >= 1) capacity += 1;
    if (tokenCount >= 24) capacity += 1;
    if (flags.length > 0) capacity += 1;

    if (textLength < 120) {
        capacity = Math.min(capacity, 2);
    } else if (textLength < 220) {
        capacity = Math.min(capacity, 3);
    } else if (textLength < 360) {
        capacity = Math.min(capacity, 4);
    }

    return clampNumber(capacity, 1, 6);
};

export const resolveEvidenceRichMcqCap = ({
    evidence,
    topicTitle,
    topicDescription,
    sourcePassageIds,
    minTarget = 1,
    maxTarget = 60,
}) => {
    const uniquePassages = extractUniquePassages(evidence);

    if (uniquePassages.length === 0) {
        return {
            cap: clampNumber(minTarget, minTarget, maxTarget),
            estimatedCapacity: 0,
            passageDrivenCap: clampNumber(minTarget, minTarget, maxTarget),
            broadTopicPenaltyApplied: false,
            uniquePassageCount: 0,
        };
    }

    const passageCapacities = uniquePassages.map((passage) => estimateEvidencePassageQuestionCapacity(passage));
    const estimatedCapacity = passageCapacities.reduce((sum, capacity) => sum + capacity, 0);
    const densePassageCount = passageCapacities.filter((capacity) => capacity >= 4).length;
    const veryDensePassageCount = passageCapacities.filter((capacity) => capacity >= 5).length;

    let passageDrivenCap =
        uniquePassages.length
        + densePassageCount
        + Math.floor(veryDensePassageCount / 2);

    if (uniquePassages.length >= 6) {
        passageDrivenCap = Math.min(
            passageDrivenCap,
            uniquePassages.length + Math.ceil(densePassageCount * 0.75)
        );
    }

    const broadTopicPenaltyApplied = isBroadCatchAllTopic({
        topicTitle,
        topicDescription,
        sourcePassageIds,
        evidencePassageCount: uniquePassages.length,
    });
    if (broadTopicPenaltyApplied) {
        passageDrivenCap = Math.min(
            passageDrivenCap,
            Math.max(4, Math.ceil(uniquePassages.length * 1.5))
        );
    }

    const cap = clampNumber(
        Math.min(estimatedCapacity, passageDrivenCap),
        minTarget,
        maxTarget
    );

    return {
        cap,
        estimatedCapacity,
        passageDrivenCap,
        broadTopicPenaltyApplied,
        uniquePassageCount: uniquePassages.length,
    };
};

export const calculateEvidenceRichMcqCap = (args) => {
    return resolveEvidenceRichMcqCap(args).cap;
};

const estimateEvidencePassageEssayCapacity = (passage) => {
    const text = String(passage?.text || "").trim();
    if (!text) return 0;

    const textLength = text.length;
    const sentenceCount = countSentenceLikeUnits(text);
    const bulletCount = countBulletLikeLines(text);
    const flags = Array.isArray(passage?.flags) ? passage.flags.filter(Boolean) : [];
    const { numericSignals, definitionSignals, exampleSignals } = countStructuredSignals(text);

    let capacity = 0;
    if (
        textLength >= 120
        || sentenceCount >= 2
        || bulletCount >= 1
        || definitionSignals >= 1
        || numericSignals >= 1
    ) {
        capacity += 1;
    }
    if (
        textLength >= 320
        && (
            sentenceCount >= 5
            || bulletCount >= 3
            || numericSignals >= 2
            || definitionSignals >= 2
            || exampleSignals >= 1
            || flags.length > 0
        )
    ) {
        capacity += 1;
    }

    return clampNumber(capacity || 1, 1, 2);
};

export const resolveEvidenceRichEssayCap = ({
    evidence,
    topicTitle,
    topicDescription,
    sourcePassageIds,
    minTarget = 1,
    maxTarget = 6,
}) => {
    const uniquePassages = extractUniquePassages(evidence);

    if (uniquePassages.length === 0) {
        return {
            cap: clampNumber(minTarget, minTarget, maxTarget),
            estimatedCapacity: 0,
            passageDrivenCap: clampNumber(minTarget, minTarget, maxTarget),
            broadTopicPenaltyApplied: false,
            uniquePassageCount: 0,
        };
    }

    const passageCapacities = uniquePassages.map((passage) => estimateEvidencePassageEssayCapacity(passage));
    const estimatedCapacity = passageCapacities.reduce((sum, capacity) => sum + capacity, 0);
    const densePassageCount = passageCapacities.filter((capacity) => capacity >= 2).length;

    let passageDrivenCap =
        Math.ceil(uniquePassages.length / 3)
        + Math.floor(densePassageCount / 2);

    const broadTopicPenaltyApplied = isBroadCatchAllTopic({
        topicTitle,
        topicDescription,
        sourcePassageIds,
        evidencePassageCount: uniquePassages.length,
    });
    if (broadTopicPenaltyApplied) {
        passageDrivenCap = Math.min(
            passageDrivenCap,
            Math.max(2, Math.ceil(uniquePassages.length / 2.5))
        );
    }

    const cap = clampNumber(
        Math.min(estimatedCapacity, passageDrivenCap),
        minTarget,
        maxTarget
    );

    return {
        cap,
        estimatedCapacity,
        passageDrivenCap,
        broadTopicPenaltyApplied,
        uniquePassageCount: uniquePassages.length,
    };
};

export const calculateEvidenceRichEssayCap = (args) => {
    return resolveEvidenceRichEssayCap(args).cap;
};

export const rebaseQuestionBankTargetAfterRun = ({
    targetCount,
    initialCount = 0,
    finalCount = 0,
    addedCount = 0,
    outcome,
    minTarget = 1,
}) => {
    const requestedTargetCount = Math.max(
        minTarget,
        Math.round(toSafeNumber(targetCount, minTarget))
    );
    const safeInitialCount = Math.max(0, Math.round(toSafeNumber(initialCount, 0)));
    const safeFinalCount = Math.max(0, Math.round(toSafeNumber(finalCount, 0)));
    const safeAddedCount = Math.max(0, Math.round(toSafeNumber(addedCount, 0)));
    const normalizedOutcome = String(outcome || "").trim().toLowerCase();

    if (!normalizedOutcome || normalizedOutcome === "completed" || normalizedOutcome === "already_generated") {
        return requestedTargetCount;
    }

    if (
        normalizedOutcome === "time_budget_reached"
        && safeAddedCount > 0
        && safeFinalCount > safeInitialCount + 1
    ) {
        return requestedTargetCount;
    }

    if (
        normalizedOutcome === "no_progress_limit_reached"
        || normalizedOutcome === "max_rounds_reached"
        || normalizedOutcome === "insufficient_evidence"
        || normalizedOutcome === "time_budget_reached"
    ) {
        if (safeFinalCount <= 0) {
            return Math.min(requestedTargetCount, Math.max(minTarget, safeInitialCount || 1));
        }
        return clampNumber(safeFinalCount, minTarget, requestedTargetCount);
    }

    return requestedTargetCount;
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
    minTarget: 35,
    maxTarget: 35,
    wordDivisor: 120,
    batchSize: 12,
    minBatchSize: 6,
    maxBatchAttempts: 1,
    requestTimeoutMs: 15_000,
    repairTimeoutMs: 3_000,
    parallelRequests: 2,
    minRounds: 3,
    maxRounds: 8,
    bufferRounds: 1,
    noProgressLimit: 3,
    timeBudgetMs: 90_000,
});
