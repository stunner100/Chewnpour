import {
    deriveConceptKey,
    normalizeConceptExerciseType,
    normalizeConceptTextKey,
} from "./conceptExerciseGeneration.js";

export const CONCEPT_MASTERY_STATUS_WEAK = "weak";
export const CONCEPT_MASTERY_STATUS_SHAKY = "shaky";
export const CONCEPT_MASTERY_STATUS_STRONG = "strong";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toRoundedPercent = (score, total) => {
    const safeTotal = Math.max(1, Number(total) || 0);
    const safeScore = clamp(Number(score) || 0, 0, safeTotal);
    return Math.round((safeScore / safeTotal) * 100);
};

export const humanizeConceptKey = (value) => {
    const normalized = String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized) return "Core Concept";
    return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
};

export const resolveConceptMasteryStatus = (strength) => {
    const normalizedStrength = clamp(Number(strength) || 0, 0, 100);
    if (normalizedStrength >= 80) return CONCEPT_MASTERY_STATUS_STRONG;
    if (normalizedStrength >= 50) return CONCEPT_MASTERY_STATUS_SHAKY;
    return CONCEPT_MASTERY_STATUS_WEAK;
};

export const resolveConceptReviewIntervalMs = ({
    strength,
    correctStreak,
}) => {
    const normalizedStrength = clamp(Number(strength) || 0, 0, 100);
    const streak = Math.max(0, Math.floor(Number(correctStreak) || 0));

    if (normalizedStrength < 50) return 12 * 60 * 60 * 1000;
    if (normalizedStrength < 70) return 24 * 60 * 60 * 1000;
    if (normalizedStrength < 85) return 3 * 24 * 60 * 60 * 1000;
    if (streak >= 4) return 14 * 24 * 60 * 60 * 1000;
    if (streak >= 2) return 7 * 24 * 60 * 60 * 1000;
    return 5 * 24 * 60 * 60 * 1000;
};

const aggregateSessionConcepts = (sessionItems = []) => {
    const aggregates = new Map();

    for (const item of Array.isArray(sessionItems) ? sessionItems : []) {
        const conceptKey = deriveConceptKey(item?.conceptKey, item?.questionText);
        const normalizedConceptKey = normalizeConceptTextKey(conceptKey).replace(/\s+/g, "_");
        if (!normalizedConceptKey) continue;

        const score = Math.max(0, Number(item?.score) || 0);
        const total = Math.max(1, Number(item?.total) || 1);
        const current = aggregates.get(normalizedConceptKey) || {
            conceptKey: normalizedConceptKey,
            conceptLabel: humanizeConceptKey(normalizedConceptKey),
            score: 0,
            total: 0,
            lastExerciseType: "cloze",
            lastQuestionText: "",
        };

        current.score += score;
        current.total += total;
        current.lastExerciseType = normalizeConceptExerciseType(item?.exerciseType);
        current.lastQuestionText = String(item?.questionText || current.lastQuestionText || "")
            .replace(/\s+/g, " ")
            .trim();
        aggregates.set(normalizedConceptKey, current);
    }

    return Array.from(aggregates.values());
};

export const buildConceptMasteryUpdates = ({
    existingRecords = [],
    sessionItems = [],
    topicId,
    userId,
    now = Date.now(),
}) => {
    const existingByKey = new Map(
        (Array.isArray(existingRecords) ? existingRecords : []).map((record) => [
            String(record?.conceptKey || "").trim(),
            record,
        ])
    );

    return aggregateSessionConcepts(sessionItems).map((aggregate) => {
        const existing = existingByKey.get(aggregate.conceptKey);
        const observedAccuracy = toRoundedPercent(aggregate.score, aggregate.total);
        const previousStrength = existing ? clamp(Number(existing.strength) || 0, 0, 100) : observedAccuracy;
        const smoothedStrength = existing
            ? Math.round((previousStrength * 0.45) + (observedAccuracy * 0.55))
            : observedAccuracy;
        const normalizedStrength = clamp(smoothedStrength, 0, 100);
        const wasPerfect = observedAccuracy >= 100;
        const correctStreak = wasPerfect
            ? Math.max(0, Math.floor(Number(existing?.correctStreak) || 0)) + 1
            : 0;
        const status = resolveConceptMasteryStatus(normalizedStrength);
        const attemptsCount = Math.max(0, Math.floor(Number(existing?.attemptsCount) || 0)) + 1;
        const correctCount = Math.max(0, Math.floor(Number(existing?.correctCount) || 0)) + aggregate.score;
        const questionCount = Math.max(0, Math.floor(Number(existing?.questionCount) || 0)) + aggregate.total;
        const nextReviewAt = now + resolveConceptReviewIntervalMs({
            strength: normalizedStrength,
            correctStreak,
        });

        return {
            existingId: existing?._id || null,
            topicId,
            userId,
            conceptKey: aggregate.conceptKey,
            conceptLabel: aggregate.conceptLabel,
            strength: normalizedStrength,
            status,
            correctStreak,
            attemptsCount,
            correctCount,
            questionCount,
            lastAccuracy: observedAccuracy,
            lastExerciseType: aggregate.lastExerciseType,
            lastQuestionText: aggregate.lastQuestionText,
            lastPracticedAt: now,
            nextReviewAt,
            updatedAt: now,
        };
    });
};

export const buildConceptMasterySummary = ({
    records = [],
    now = Date.now(),
    maxConcepts = 6,
}) => {
    const items = (Array.isArray(records) ? records : [])
        .map((record) => {
            const strength = clamp(Number(record?.strength) || 0, 0, 100);
            const nextReviewAt = Number(record?.nextReviewAt) || 0;
            const due = nextReviewAt <= now;
            const explicitStatus = String(record?.status || "").trim().toLowerCase();
            return {
                conceptKey: String(record?.conceptKey || "").trim(),
                conceptLabel: String(record?.conceptLabel || "").trim() || humanizeConceptKey(record?.conceptKey),
                strength,
                status:
                    explicitStatus === CONCEPT_MASTERY_STATUS_WEAK
                    || explicitStatus === CONCEPT_MASTERY_STATUS_SHAKY
                    || explicitStatus === CONCEPT_MASTERY_STATUS_STRONG
                        ? explicitStatus
                        : resolveConceptMasteryStatus(strength),
                nextReviewAt,
                due,
                correctStreak: Math.max(0, Math.floor(Number(record?.correctStreak) || 0)),
                lastAccuracy: clamp(Number(record?.lastAccuracy) || 0, 0, 100),
                lastExerciseType: normalizeConceptExerciseType(record?.lastExerciseType),
                lastQuestionText: String(record?.lastQuestionText || "").replace(/\s+/g, " ").trim(),
            };
        })
        .filter((record) => record.conceptKey)
        .sort((left, right) => {
            if (Number(left.due) !== Number(right.due)) return Number(right.due) - Number(left.due);
            if (left.strength !== right.strength) return left.strength - right.strength;
            return left.nextReviewAt - right.nextReviewAt;
        });

    const strongCount = items.filter((item) => item.status === CONCEPT_MASTERY_STATUS_STRONG).length;
    const shakyCount = items.filter((item) => item.status === CONCEPT_MASTERY_STATUS_SHAKY).length;
    const weakCount = items.filter((item) => item.status === CONCEPT_MASTERY_STATUS_WEAK).length;
    const dueItems = items.filter((item) => item.due);
    const dueCount = dueItems.length;
    const averageStrength = items.length > 0
        ? Math.round(items.reduce((sum, item) => sum + item.strength, 0) / items.length)
        : null;
    const reviewConceptKeys = (dueItems.length > 0 ? dueItems : items)
        .map((item) => item.conceptKey)
        .filter(Boolean)
        .slice(0, Math.max(1, Math.floor(Number(maxConcepts) || 6)));
    const nextReviewAt = items.length > 0
        ? items.reduce((earliest, item) => {
            if (!earliest) return item.nextReviewAt;
            return item.nextReviewAt < earliest ? item.nextReviewAt : earliest;
        }, 0)
        : null;

    return {
        totalConcepts: items.length,
        strongCount,
        shakyCount,
        weakCount,
        dueCount,
        averageStrength,
        nextReviewAt,
        reviewConceptKeys,
        items,
    };
};
