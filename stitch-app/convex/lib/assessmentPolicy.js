import { normalizeBloomLevel, normalizeOutcomeKey } from "./assessmentBlueprint.js";

const resolveRequestedExamFormat = (value) =>
    String(value || "").trim().toLowerCase() === "essay" ? "essay" : "mcq";

const toPositiveInteger = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return Math.max(0, Math.round(Number(fallback) || 0));
    }
    return Math.max(1, Math.round(numeric));
};

const buildCoverageTargets = ({ blueprint, examFormat, targetCount }) => {
    const normalizedFormat = resolveRequestedExamFormat(examFormat);
    const activePlan = normalizedFormat === "essay"
        ? blueprint?.essayPlan
        : (
            blueprint?.objectivePlan
            || blueprint?.multipleChoicePlan
            || blueprint?.mcqPlan
        );
    const outcomes = Array.isArray(blueprint?.outcomes) ? blueprint.outcomes : [];
    const outcomeByKey = new Map(
        outcomes
            .map((outcome) => {
                const key = normalizeOutcomeKey(outcome?.key);
                if (!key) return null;
                return [key, outcome];
            })
            .filter(Boolean)
    );
    const orderedOutcomeKeys = (Array.isArray(activePlan?.targetOutcomeKeys) ? activePlan.targetOutcomeKeys : [])
        .map((value) => normalizeOutcomeKey(value))
        .filter((key) => outcomeByKey.has(key));

    const safeTargetCount = toPositiveInteger(targetCount, orderedOutcomeKeys.length);
    if (orderedOutcomeKeys.length === 0 || safeTargetCount === 0) {
        return [];
    }

    const targetSlots = [];
    for (let slotIndex = 0; slotIndex < safeTargetCount; slotIndex += 1) {
        targetSlots.push(orderedOutcomeKeys[slotIndex % orderedOutcomeKeys.length]);
    }

    const desiredCountByOutcome = new Map();
    for (const outcomeKey of targetSlots) {
        desiredCountByOutcome.set(
            outcomeKey,
            Number(desiredCountByOutcome.get(outcomeKey) || 0) + 1
        );
    }

    return orderedOutcomeKeys.map((outcomeKey) => {
        const outcome = outcomeByKey.get(outcomeKey);
        return {
            outcomeKey,
            bloomLevel: normalizeBloomLevel(outcome?.bloomLevel || ""),
            objective: String(outcome?.objective || "").trim(),
            evidenceFocus: String(outcome?.evidenceFocus || "").trim(),
            desiredCount: Number(desiredCountByOutcome.get(outcomeKey) || 0),
        };
    }).filter((target) => target.desiredCount > 0);
};

const buildCurrentCoverageCounts = ({ questions, examFormat }) => {
    const normalizedFormat = resolveRequestedExamFormat(examFormat);
    const items = Array.isArray(questions) ? questions : [];
    const countByOutcome = new Map();

    for (const question of items) {
        const questionType = String(question?.questionType || "").trim().toLowerCase();
        const matchesFormat = normalizedFormat === "essay"
            ? questionType === "essay"
            : questionType !== "essay";
        if (!matchesFormat) continue;

        const outcomeKey = normalizeOutcomeKey(question?.outcomeKey);
        const bloomLevel = normalizeBloomLevel(question?.bloomLevel || "");
        if (!outcomeKey || !bloomLevel) continue;

        const existing = countByOutcome.get(outcomeKey) || { count: 0, bloomLevel };
        countByOutcome.set(outcomeKey, {
            count: Number(existing.count || 0) + 1,
            bloomLevel: existing.bloomLevel || bloomLevel,
        });
    }

    return countByOutcome;
};

export const computeQuestionCoverageGaps = ({
    blueprint,
    examFormat,
    questions,
    targetCount,
}) => {
    const normalizedFormat = resolveRequestedExamFormat(examFormat);
    const coverageTargets = buildCoverageTargets({
        blueprint,
        examFormat: normalizedFormat,
        targetCount,
    });

    if (coverageTargets.length === 0) {
        return {
            examFormat: normalizedFormat,
            status: "unavailable",
            reasonCode: "NO_TARGET_OUTCOMES",
            targetCount: toPositiveInteger(targetCount, 0),
            coveredCount: 0,
            totalGapCount: 0,
            requiredOutcomeCoverageCount: 0,
            freshnessTargetCount: 0,
            coverageTargets: [],
            gaps: [],
            gapSlots: [],
        };
    }

    const currentCoverage = buildCurrentCoverageCounts({
        questions,
        examFormat: normalizedFormat,
    });

    const gaps = coverageTargets.map((target) => {
        const currentCount = Number(currentCoverage.get(target.outcomeKey)?.count || 0);
        const gapCount = Math.max(0, target.desiredCount - currentCount);
        return {
            ...target,
            currentCount,
            gapCount,
        };
    });

    const coveredCount = gaps.reduce(
        (sum, target) => sum + Math.min(target.currentCount, target.desiredCount),
        0
    );
    const totalGapCount = gaps.reduce((sum, target) => sum + target.gapCount, 0);
    const requiredOutcomeCoverageCount = gaps.filter((target) => target.desiredCount > 0).length;
    const gapSlots = [];

    while (gapSlots.length < totalGapCount) {
        let progressed = false;
        for (const gap of gaps) {
            const currentGapCountForOutcome = gapSlots.filter(
                (slot) => slot.outcomeKey === gap.outcomeKey
            ).length;
            if (currentGapCountForOutcome < gap.gapCount) {
                gapSlots.push({
                    outcomeKey: gap.outcomeKey,
                    bloomLevel: gap.bloomLevel,
                    objective: gap.objective,
                    evidenceFocus: gap.evidenceFocus,
                });
                progressed = true;
            }
        }
        if (!progressed) break;
    }

    const safeTargetCount = toPositiveInteger(targetCount, coverageTargets.length);
    return {
        examFormat: normalizedFormat,
        status: totalGapCount === 0 ? "ready" : "needs_generation",
        reasonCode: totalGapCount === 0 ? undefined : "MISSING_OUTCOME_COVERAGE",
        targetCount: safeTargetCount,
        coveredCount,
        totalGapCount,
        requiredOutcomeCoverageCount,
        freshnessTargetCount: Math.min(
            safeTargetCount,
            Math.max(1, Math.ceil(safeTargetCount * 0.7))
        ),
        coverageTargets,
        gaps,
        gapSlots,
    };
};

export const selectCoverageGapTargets = ({
    coverage,
    requestedCount,
}) => {
    const safeRequestedCount = Math.max(1, toPositiveInteger(requestedCount, 1));
    const gapSlots = Array.isArray(coverage?.gapSlots) ? coverage.gapSlots : [];
    if (gapSlots.length === 0) {
        return [];
    }

    const countsByOutcome = new Map();
    for (const slot of gapSlots.slice(0, safeRequestedCount)) {
        const prior = countsByOutcome.get(slot.outcomeKey) || {
            ...slot,
            requestedCount: 0,
        };
        countsByOutcome.set(slot.outcomeKey, {
            ...prior,
            requestedCount: Number(prior.requestedCount || 0) + 1,
        });
    }

    return Array.from(countsByOutcome.values());
};

export const resolveAssessmentGenerationPolicy = ({
    blueprint,
    examFormat,
    questions,
    targetCount,
}) => {
    const coverage = computeQuestionCoverageGaps({
        blueprint,
        examFormat,
        questions,
        targetCount,
    });

    return {
        ...coverage,
        ready: coverage.status === "ready",
        needsGeneration: coverage.status === "needs_generation",
        unavailable: coverage.status === "unavailable",
    };
};
