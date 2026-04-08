import {
    OBJECTIVE_TARGET_MIX,
    QUESTION_TYPE_ESSAY,
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
    normalizeQuestionType,
} from "./objectiveExam.js";

export const ASSESSMENT_BLUEPRINT_VERSION = "assessment-blueprint-v4";

export const BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
];

export const MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
];
export const MULTIPLE_CHOICE_TARGET_BLOOM_LEVELS = [
    "Apply",
    "Analyze",
];

export const TRUE_FALSE_ALLOWED_BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
];
export const TRUE_FALSE_TARGET_BLOOM_LEVELS = [
    "Apply",
];

export const FILL_BLANK_ALLOWED_BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
];
export const FILL_BLANK_TARGET_BLOOM_LEVELS = [
    "Apply",
];

export const ESSAY_ALLOWED_BLOOM_LEVELS = [
    "Analyze",
    "Evaluate",
    "Create",
];

export const MCQ_ALLOWED_BLOOM_LEVELS = MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS;
export const COGNITIVE_TASKS = [
    "define",
    "identify",
    "summarize",
    "explain",
    "apply",
    "compare",
    "diagnose",
    "interpret",
    "analyze",
    "evaluate",
    "critique",
    "justify",
    "design",
];

export const DIFFICULTY_BANDS = ["easy", "medium", "hard"];

export const DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION = {
    easy: 0.1,
    medium: 0.3,
    hard: 0.6,
};

const QUESTION_TYPE_PLAN_KEYS = {
    [QUESTION_TYPE_MULTIPLE_CHOICE]: "multipleChoicePlan",
    [QUESTION_TYPE_TRUE_FALSE]: "trueFalsePlan",
    [QUESTION_TYPE_FILL_BLANK]: "fillBlankPlan",
    [QUESTION_TYPE_ESSAY]: "essayPlan",
};

const QUESTION_TYPE_ALLOWED_BLOOM_LEVELS = {
    [QUESTION_TYPE_MULTIPLE_CHOICE]: MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS,
    [QUESTION_TYPE_TRUE_FALSE]: TRUE_FALSE_ALLOWED_BLOOM_LEVELS,
    [QUESTION_TYPE_FILL_BLANK]: FILL_BLANK_ALLOWED_BLOOM_LEVELS,
    [QUESTION_TYPE_ESSAY]: ESSAY_ALLOWED_BLOOM_LEVELS,
};

const BLOOM_LEVEL_INDEX = new Map(
    BLOOM_LEVELS.map((level) => [level.toLowerCase(), level])
);

const normalizeText = (value) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim();

const ALIGNMENT_STOPWORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "does",
    "for",
    "from",
    "how",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "same",
    "show",
    "student",
    "students",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "using",
    "what",
    "when",
    "which",
    "with",
]);

const tokenizeAlignmentText = (value) =>
    Array.from(
        new Set(
            normalizeText(value)
                .toLowerCase()
                .replace(/[^a-z0-9/.\s-]+/g, " ")
                .split(/\s+/)
                .map((token) => token.trim())
                .filter((token) => token.length >= 3 && !ALIGNMENT_STOPWORDS.has(token))
        )
    );

const measureTokenOverlap = (haystackTokens, needleTokens) => {
    if (!needleTokens.length) return 0;
    const haystack = new Set(haystackTokens);
    let overlapCount = 0;
    for (const token of needleTokens) {
        if (haystack.has(token)) overlapCount += 1;
    }
    return overlapCount / needleTokens.length;
};

const extractAlignmentPhrases = (value) =>
    normalizeText(value)
        .split(/[.;:]/)
        .map((phrase) => normalizeText(phrase).toLowerCase())
        .filter((phrase) => phrase.length >= 8);

const countPhraseHits = (questionText, phrases) => {
    const haystack = normalizeText(questionText).toLowerCase();
    if (!haystack || phrases.length === 0) return 0;
    let hits = 0;
    for (const phrase of phrases) {
        if (haystack.includes(phrase)) hits += 1;
    }
    return hits;
};

const buildQuestionAlignmentText = (question) => {
    const options = Array.isArray(question?.options)
        ? question.options.map((option) => option?.text || option).join(" ")
        : "";
    const templateParts = Array.isArray(question?.templateParts)
        ? question.templateParts.filter((part) => part !== "__").join(" ")
        : "";
    const acceptedAnswers = Array.isArray(question?.acceptedAnswers)
        ? question.acceptedAnswers.join(" ")
        : "";

    return [
        question?.questionText,
        question?.explanation,
        question?.learningObjective,
        question?.authenticContext,
        options,
        templateParts,
        acceptedAnswers,
    ].filter(Boolean).join(" ");
};

const scoreOutcomeAlignment = (question, outcome) => {
    const questionText = buildQuestionAlignmentText(question);
    const questionTokens = tokenizeAlignmentText(buildQuestionAlignmentText(question));
    const evidenceFocusTokens = tokenizeAlignmentText(outcome?.evidenceFocus);
    const objectiveTokens = tokenizeAlignmentText(outcome?.objective);
    const scenarioTokens = tokenizeAlignmentText(outcome?.scenarioFrame);
    const evidenceFocusOverlap = measureTokenOverlap(questionTokens, evidenceFocusTokens);
    const objectiveOverlap = measureTokenOverlap(questionTokens, objectiveTokens);
    const scenarioOverlap = measureTokenOverlap(questionTokens, scenarioTokens);
    const phraseHits = countPhraseHits(questionText, [
        ...extractAlignmentPhrases(outcome?.evidenceFocus),
        ...extractAlignmentPhrases(outcome?.scenarioFrame),
    ]);
    const arithmeticContextBonus = /[0-9]\s*\/\s*[0-9]|[=+\-*/]/.test(questionText)
        && /denominator|numerator|fraction addition|adding fractions|same denominator|add denominators directly|1\/4 \+ 2\/4/i.test(
            `${outcome?.evidenceFocus || ""} ${outcome?.objective || ""} ${outcome?.scenarioFrame || ""}`
        )
        ? 0.12
        : 0;

    return (
        evidenceFocusOverlap * 0.5
        + objectiveOverlap * 0.35
        + scenarioOverlap * 0.15
        + Math.min(0.2, phraseHits * 0.1)
        + arithmeticContextBonus
    );
};

const resolveBestAlignedOutcome = ({ question, blueprint }) => {
    const candidates = Array.isArray(blueprint?.outcomes)
        ? blueprint.outcomes
        : [];

    let bestOutcome = null;
    let bestScore = 0;
    for (const outcome of candidates) {
        const score = scoreOutcomeAlignment(question, outcome);
        if (score > bestScore) {
            bestScore = score;
            bestOutcome = outcome;
        }
    }

    return {
        outcome: bestOutcome,
        score: bestScore,
    };
};

export const normalizeBloomLevel = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    return BLOOM_LEVEL_INDEX.get(normalized) || "";
};

export const normalizeOutcomeKey = (value) =>
    normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

export const normalizeDifficultyBand = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === "hard") return "hard";
    if (normalized === "easy") return "easy";
    return "medium";
};

export const normalizeCognitiveTask = (value, bloomLevel = "") => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized && COGNITIVE_TASKS.includes(normalized)) {
        return normalized;
    }
    const fallbackByBloom = {
        Remember: "identify",
        Understand: "explain",
        Apply: "apply",
        Analyze: "analyze",
        Evaluate: "justify",
        Create: "design",
    };
    return fallbackByBloom[normalizeBloomLevel(bloomLevel)] || "explain";
};

const uniqueStringArray = (values) =>
    Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .map((value) => normalizeText(value))
                .filter(Boolean)
        )
    );

const normalizeOutcomeRecord = (outcome, index) => {
    if (!outcome || typeof outcome !== "object") return null;
    const objective = normalizeText(outcome.objective);
    const bloomLevel = normalizeBloomLevel(outcome.bloomLevel);
    const evidenceFocus = normalizeText(outcome.evidenceFocus || outcome.evidenceSummary);
    const key = normalizeOutcomeKey(outcome.key || `outcome-${index + 1}`);
    if (!objective || !bloomLevel || !evidenceFocus || !key) {
        return null;
    }
    return {
        key,
        objective,
        bloomLevel,
        evidenceFocus,
        cognitiveTask: normalizeCognitiveTask(outcome.cognitiveTask, bloomLevel),
        difficultyBand: normalizeDifficultyBand(outcome.difficultyBand),
        scenarioFrame: normalizeText(outcome.scenarioFrame || outcome.authenticContextHint) || undefined,
        subClaimId: normalizeText(outcome.subClaimId) || undefined,
        claimType: normalizeText(outcome.claimType) || undefined,
        questionYieldEstimate: Math.max(1, Math.round(Number(outcome.questionYieldEstimate || 1))),
    };
};

const normalizeDifficultyDistribution = (value) => {
    const safeValue = value && typeof value === "object" ? value : {};
    const easy = Math.max(0, Number(safeValue.easy || DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION.easy));
    const medium = Math.max(0, Number(safeValue.medium || DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION.medium));
    const hard = Math.max(0, Number(safeValue.hard || DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION.hard));
    const total = easy + medium + hard;
    if (total <= 0) {
        return { ...DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION };
    }
    return {
        easy: easy / total,
        medium: medium / total,
        hard: hard / total,
    };
};

const normalizeTargetMix = (value, fallback = OBJECTIVE_TARGET_MIX) => {
    const safeValue = value && typeof value === "object" ? value : {};
    return {
        multiple_choice: Math.max(1, Math.round(Number(safeValue.multiple_choice ?? fallback.multiple_choice ?? OBJECTIVE_TARGET_MIX.multiple_choice))),
        true_false: Math.max(0, Math.round(Number(safeValue.true_false ?? fallback.true_false ?? OBJECTIVE_TARGET_MIX.true_false))),
        fill_blank: Math.max(0, Math.round(Number(safeValue.fill_blank ?? fallback.fill_blank ?? OBJECTIVE_TARGET_MIX.fill_blank))),
    };
};

const normalizePlanKeys = ({
    rawKeys,
    outcomeByKey,
    allowedBloomLevels,
    preferredBloomLevels,
    fallbackOutcomes,
}) => {
    const requestedKeys = uniqueStringArray(rawKeys).map((value) => normalizeOutcomeKey(value));
    const preferredLevels = uniqueStringArray(preferredBloomLevels).filter((level) =>
        allowedBloomLevels.includes(level)
    );
    const matchesAllowedBloom = (key, bloomLevels) => {
        const outcome = outcomeByKey.get(key);
        return outcome && bloomLevels.includes(outcome.bloomLevel);
    };

    const acceptedKeys = requestedKeys.filter((key) => matchesAllowedBloom(key, allowedBloomLevels));
    if (acceptedKeys.length > 0) {
        return acceptedKeys;
    }

    const preferredFallbackKeys = preferredLevels.length > 0
        ? fallbackOutcomes
            .filter((outcome) => preferredLevels.includes(outcome.bloomLevel))
            .map((outcome) => outcome.key)
        : [];
    if (preferredFallbackKeys.length > 0) {
        return preferredFallbackKeys;
    }

    return fallbackOutcomes
        .filter((outcome) => allowedBloomLevels.includes(outcome.bloomLevel))
        .map((outcome) => outcome.key);
};

const normalizeSubtypePlan = ({
    rawPlan,
    outcomeByKey,
    fallbackOutcomes,
    allowedBloomLevels,
    preferredBloomLevels,
    extraFields = {},
}) => {
    const targetOutcomeKeys = normalizePlanKeys({
        rawKeys: rawPlan?.targetOutcomeKeys,
        outcomeByKey,
        allowedBloomLevels,
        preferredBloomLevels,
        fallbackOutcomes,
    });
    if (targetOutcomeKeys.length === 0) {
        return null;
    }
    const targetBloomLevels = uniqueStringArray(
        targetOutcomeKeys.map((key) => outcomeByKey.get(key)?.bloomLevel)
    ).filter((level) => allowedBloomLevels.includes(level));

    return {
        allowedBloomLevels: [...allowedBloomLevels],
        targetBloomLevels,
        targetOutcomeKeys,
        ...extraFields,
    };
};

export const normalizeAssessmentBlueprint = (raw) => {
    if (!raw || typeof raw !== "object") return null;

    const normalizedOutcomes = [];
    const seenKeys = new Set();
    for (const [index, outcome] of (Array.isArray(raw.outcomes) ? raw.outcomes : []).entries()) {
        const normalized = normalizeOutcomeRecord(outcome, index);
        if (!normalized) continue;

        let key = normalized.key;
        if (seenKeys.has(key)) {
            key = `${key}-${index + 1}`;
        }
        seenKeys.add(key);
        normalizedOutcomes.push({
            ...normalized,
            key,
        });
    }

    if (normalizedOutcomes.length === 0) {
        return null;
    }

    const outcomeByKey = new Map(normalizedOutcomes.map((outcome) => [outcome.key, outcome]));
    const rawMultipleChoicePlan =
        raw.multipleChoicePlan && typeof raw.multipleChoicePlan === "object"
            ? raw.multipleChoicePlan
            : {};
    const rawTrueFalsePlan = raw.trueFalsePlan && typeof raw.trueFalsePlan === "object"
        ? raw.trueFalsePlan
        : {};
    const rawFillBlankPlan = raw.fillBlankPlan && typeof raw.fillBlankPlan === "object"
        ? raw.fillBlankPlan
        : {};
    const rawEssayPlan = raw.essayPlan && typeof raw.essayPlan === "object" ? raw.essayPlan : {};

    const multipleChoicePlan = normalizeSubtypePlan({
        rawPlan: rawMultipleChoicePlan,
        outcomeByKey,
        fallbackOutcomes: normalizedOutcomes,
        allowedBloomLevels: MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS,
        preferredBloomLevels: MULTIPLE_CHOICE_TARGET_BLOOM_LEVELS,
    });
    const trueFalsePlan = normalizeSubtypePlan({
        rawPlan: rawTrueFalsePlan,
        outcomeByKey,
        fallbackOutcomes: normalizedOutcomes,
        allowedBloomLevels: TRUE_FALSE_ALLOWED_BLOOM_LEVELS,
        preferredBloomLevels: TRUE_FALSE_TARGET_BLOOM_LEVELS,
    });
    const fillBlankPlan = normalizeSubtypePlan({
        rawPlan: rawFillBlankPlan,
        outcomeByKey,
        fallbackOutcomes: normalizedOutcomes,
        allowedBloomLevels: FILL_BLANK_ALLOWED_BLOOM_LEVELS,
        preferredBloomLevels: FILL_BLANK_TARGET_BLOOM_LEVELS,
        extraFields: {
            tokenBankRequired: rawFillBlankPlan.tokenBankRequired !== false,
            exactAnswerOnly: rawFillBlankPlan.exactAnswerOnly !== false,
        },
    });
    const essayPlan = normalizeSubtypePlan({
        rawPlan: rawEssayPlan,
        outcomeByKey,
        fallbackOutcomes: normalizedOutcomes,
        allowedBloomLevels: ESSAY_ALLOWED_BLOOM_LEVELS,
        preferredBloomLevels: ESSAY_ALLOWED_BLOOM_LEVELS,
        extraFields: {
            authenticScenarioRequired: rawEssayPlan.authenticScenarioRequired === true,
            authenticContextHint: normalizeText(
                rawEssayPlan.authenticContextHint || rawEssayPlan.authenticContext
            ) || undefined,
        },
    });

    if (!multipleChoicePlan || !trueFalsePlan || !fillBlankPlan || !essayPlan) {
        return null;
    }

    const objectiveOutcomeKeys = uniqueStringArray([
        ...multipleChoicePlan.targetOutcomeKeys,
        ...trueFalsePlan.targetOutcomeKeys,
        ...fillBlankPlan.targetOutcomeKeys,
    ]).map((key) => normalizeOutcomeKey(key)).filter(Boolean);
    const objectiveTargetBloomLevels = uniqueStringArray(
        objectiveOutcomeKeys.map((key) => outcomeByKey.get(key)?.bloomLevel)
    ).filter(Boolean);

    return {
        version: ASSESSMENT_BLUEPRINT_VERSION,
        outcomes: normalizedOutcomes,
        subClaimCount: Math.max(0, Math.round(Number(raw.subClaimCount || normalizedOutcomes.length))),
        distractorCount: Math.max(0, Math.round(Number(raw.distractorCount || 0))),
        yieldEstimate: raw.yieldEstimate && typeof raw.yieldEstimate === "object"
            ? {
                mcqTarget: Math.max(1, Math.round(Number(raw.yieldEstimate.mcqTarget || OBJECTIVE_TARGET_MIX[QUESTION_TYPE_MULTIPLE_CHOICE]))),
                trueFalseTarget: Math.max(0, Math.round(Number(raw.yieldEstimate.trueFalseTarget || OBJECTIVE_TARGET_MIX[QUESTION_TYPE_TRUE_FALSE]))),
                fillInTarget: Math.max(0, Math.round(Number(raw.yieldEstimate.fillInTarget || OBJECTIVE_TARGET_MIX[QUESTION_TYPE_FILL_BLANK]))),
                essayTarget: Math.max(0, Math.round(Number(raw.yieldEstimate.essayTarget || 1))),
                totalObjectiveTarget: Math.max(1, Math.round(Number(raw.yieldEstimate.totalObjectiveTarget || objectiveOutcomeKeys.length || 1))),
                confidence: normalizeText(raw.yieldEstimate.confidence || "low").toLowerCase() || "low",
                reasoning: normalizeText(raw.yieldEstimate.reasoning || ""),
            }
            : undefined,
        objectivePlan: {
            allowedQuestionTypes: [
                QUESTION_TYPE_MULTIPLE_CHOICE,
                QUESTION_TYPE_TRUE_FALSE,
                QUESTION_TYPE_FILL_BLANK,
            ],
            targetQuestionTypes: [
                QUESTION_TYPE_MULTIPLE_CHOICE,
                QUESTION_TYPE_TRUE_FALSE,
                QUESTION_TYPE_FILL_BLANK,
            ],
            targetMix: normalizeTargetMix(
                raw.objectivePlan?.targetMix,
                raw.yieldEstimate
                    ? {
                        multiple_choice: raw.yieldEstimate.mcqTarget,
                        true_false: raw.yieldEstimate.trueFalseTarget,
                        fill_blank: raw.yieldEstimate.fillInTarget,
                    }
                    : OBJECTIVE_TARGET_MIX
            ),
            targetOutcomeKeys: objectiveOutcomeKeys,
            targetBloomLevels: objectiveTargetBloomLevels,
            targetDifficultyDistribution: normalizeDifficultyDistribution(raw.objectivePlan?.targetDifficultyDistribution),
            minDistinctOutcomeCount: Math.max(
                1,
                Math.min(
                    objectiveOutcomeKeys.length,
                    Math.round(Number(raw.objectivePlan?.minDistinctOutcomeCount || 3))
                )
            ),
            items: Array.isArray(raw.objectivePlan?.items) ? raw.objectivePlan.items : [],
        },
        multipleChoicePlan,
        trueFalsePlan,
        fillBlankPlan,
        essayPlan: {
            ...essayPlan,
            minDistinctOutcomeCount: Math.max(
                1,
                Math.min(
                    essayPlan.targetOutcomeKeys.length,
                    Math.round(Number(rawEssayPlan.minDistinctOutcomeCount || 2))
                )
            ),
            minDistinctScenarioFrameCount: Math.max(
                1,
                Math.round(Number(rawEssayPlan.minDistinctScenarioFrameCount || 2))
            ),
            items: Array.isArray(rawEssayPlan?.items) ? rawEssayPlan.items : [],
        },
    };
};

const toTitleBloomLevel = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    const title =
        normalized === "remember" ? "Remember"
            : normalized === "understand" ? "Understand"
                : normalized === "apply" ? "Apply"
                    : normalized === "analyze" ? "Analyze"
                        : normalized === "evaluate" ? "Evaluate"
                            : normalized === "create" ? "Create"
                                : "";
    return title || "Understand";
};

const mapClaimToCognitiveTask = (claim) => {
    const operations = Array.isArray(claim?.cognitiveOperations) ? claim.cognitiveOperations.map((value) => normalizeText(value).toLowerCase()) : [];
    if (operations.includes("evaluation")) return "evaluate";
    if (operations.includes("comparison")) return "compare";
    if (operations.includes("inference")) return "interpret";
    if (operations.includes("application")) return "apply";
    if (operations.includes("recall")) return "identify";
    return "explain";
};

const buildOutcomeFromClaim = (claim, index) => {
    const objective = normalizeText(claim?.claimText);
    const key = normalizeOutcomeKey(claim?.key || `claim-${index + 1}`);
    if (!objective || !key) return null;
    const quotes = Array.isArray(claim?.sourceQuotes) ? claim.sourceQuotes.map((value) => normalizeText(value)).filter(Boolean) : [];
    return {
        key,
        objective,
        bloomLevel: toTitleBloomLevel(claim?.bloomLevel),
        evidenceFocus: quotes[0] || objective,
        cognitiveTask: mapClaimToCognitiveTask(claim),
        difficultyBand: normalizeDifficultyBand(claim?.difficultyEstimate),
        scenarioFrame: normalizeText(claim?.scenarioFrame) || undefined,
        subClaimId: normalizeText(claim?._id || claim?.subClaimId || "") || undefined,
        claimType: normalizeText(claim?.claimType) || undefined,
        questionYieldEstimate: Math.max(1, Math.round(Number(claim?.questionYieldEstimate || 1))),
    };
};

const filterOutcomeKeysByOperations = (outcomes, claimsByOutcomeKey, allowedOperations, allowedBloomLevels) =>
    outcomes
        .filter((outcome) => {
            const claim = claimsByOutcomeKey.get(outcome.key);
            const operations = Array.isArray(claim?.cognitiveOperations) ? claim.cognitiveOperations.map((value) => normalizeText(value).toLowerCase()) : [];
            const matchesOperation = operations.some((operation) => allowedOperations.includes(operation));
            return matchesOperation && allowedBloomLevels.includes(outcome.bloomLevel);
        })
        .map((outcome) => outcome.key);

const buildObjectivePlanItems = (outcomes, claimsByOutcomeKey) => {
    const items = [];
    let priority = 0;
    for (const outcome of outcomes) {
        const claim = claimsByOutcomeKey.get(outcome.key);
        const operations = Array.isArray(claim?.cognitiveOperations) ? claim.cognitiveOperations.map((value) => normalizeText(value).toLowerCase()) : [];
        const claimDifficulty = normalizeDifficultyBand(claim?.difficultyEstimate);

        if (operations.includes("recognition")) {
            items.push({
                outcomeKey: outcome.key,
                subClaimId: outcome.subClaimId,
                claimText: outcome.objective,
                targetOp: "recognition",
                targetType: QUESTION_TYPE_MULTIPLE_CHOICE,
                targetDifficulty: claimDifficulty,
                targetTier: 1,
                priority: priority++,
                status: "planned",
            });
        }
        if (operations.includes("recall")) {
            items.push({
                outcomeKey: outcome.key,
                subClaimId: outcome.subClaimId,
                claimText: outcome.objective,
                targetOp: "recall",
                targetType: QUESTION_TYPE_FILL_BLANK,
                targetDifficulty: claimDifficulty,
                targetTier: 1,
                priority: priority++,
                status: "planned",
            });
        }
        if (operations.includes("discrimination")) {
            items.push({
                outcomeKey: outcome.key,
                subClaimId: outcome.subClaimId,
                claimText: outcome.objective,
                targetOp: "discrimination",
                targetType: QUESTION_TYPE_TRUE_FALSE,
                targetDifficulty: claimDifficulty,
                targetTier: 1,
                priority: priority++,
                status: "planned",
            });
        }
        if (operations.includes("application")) {
            items.push({
                outcomeKey: outcome.key,
                subClaimId: outcome.subClaimId,
                claimText: outcome.objective,
                targetOp: "application",
                targetType: QUESTION_TYPE_MULTIPLE_CHOICE,
                targetDifficulty: claimDifficulty === "easy" ? "medium" : claimDifficulty,
                targetTier: 2,
                priority: priority++,
                status: "planned",
            });
        }
        if (operations.includes("comparison") || operations.includes("inference")) {
            items.push({
                outcomeKey: outcome.key,
                subClaimId: outcome.subClaimId,
                claimText: outcome.objective,
                targetOp: operations.includes("comparison") ? "comparison" : "inference",
                targetType: QUESTION_TYPE_MULTIPLE_CHOICE,
                targetDifficulty: claimDifficulty === "easy" ? "medium" : "hard",
                targetTier: operations.includes("comparison") ? 2 : 3,
                priority: priority++,
                status: "planned",
            });
        }
    }
    return items;
};

const buildEssayPlanItems = (outcomes, claimsByOutcomeKey) => {
    const essayEligible = outcomes.filter((outcome) => {
        const claim = claimsByOutcomeKey.get(outcome.key);
        const operations = Array.isArray(claim?.cognitiveOperations) ? claim.cognitiveOperations.map((value) => normalizeText(value).toLowerCase()) : [];
        return operations.includes("evaluation") || operations.includes("synthesis") || operations.includes("inference");
    });

    const items = [];
    for (let index = 0; index < essayEligible.length; index += 3) {
        const slice = essayEligible.slice(index, index + 3);
        if (slice.length === 0) continue;
        items.push({
            sourceSubClaimIds: slice.map((outcome) => outcome.subClaimId).filter(Boolean),
            sourceOutcomeKeys: slice.map((outcome) => outcome.key),
            targetBloomLevel: slice.some((outcome) => outcome.bloomLevel === "Evaluate" || outcome.bloomLevel === "Create")
                ? "Evaluate"
                : "Analyze",
            targetDifficulty: slice.some((outcome) => outcome.difficultyBand === "hard") ? "hard" : "medium",
            promptSeed: `Synthesize ${slice.map((outcome) => outcome.objective).join("; ")}`,
            status: "planned",
        });
    }
    return items;
};

export const buildClaimDrivenAssessmentBlueprint = ({
    subClaims,
    yieldEstimate,
    distractorCount = 0,
}) => {
    const outcomes = (Array.isArray(subClaims) ? subClaims : [])
        .map((claim, index) => buildOutcomeFromClaim(claim, index))
        .filter(Boolean);
    if (outcomes.length === 0) {
        return null;
    }

    const claimsByOutcomeKey = new Map(
        outcomes.map((outcome, index) => [outcome.key, subClaims[index]])
    );

    const multipleChoiceKeys = filterOutcomeKeysByOperations(
        outcomes,
        claimsByOutcomeKey,
        ["recognition", "application", "comparison", "inference"],
        MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS,
    );
    const trueFalseKeys = filterOutcomeKeysByOperations(
        outcomes,
        claimsByOutcomeKey,
        ["discrimination", "recognition"],
        TRUE_FALSE_ALLOWED_BLOOM_LEVELS,
    );
    const fillBlankKeys = filterOutcomeKeysByOperations(
        outcomes,
        claimsByOutcomeKey,
        ["recall"],
        FILL_BLANK_ALLOWED_BLOOM_LEVELS,
    );
    const essayKeys = filterOutcomeKeysByOperations(
        outcomes,
        claimsByOutcomeKey,
        ["evaluation", "synthesis", "inference"],
        ESSAY_ALLOWED_BLOOM_LEVELS,
    );

    const objectiveOutcomeKeys = uniqueStringArray([
        ...multipleChoiceKeys,
        ...trueFalseKeys,
        ...fillBlankKeys,
    ]);
    const objectivePlanItems = buildObjectivePlanItems(outcomes, claimsByOutcomeKey);
    const essayPlanItems = buildEssayPlanItems(outcomes, claimsByOutcomeKey);

    return normalizeAssessmentBlueprint({
        version: ASSESSMENT_BLUEPRINT_VERSION,
        outcomes,
        subClaimCount: outcomes.length,
        distractorCount,
        yieldEstimate,
        objectivePlan: {
            targetMix: {
                multiple_choice: yieldEstimate?.mcqTarget ?? OBJECTIVE_TARGET_MIX[QUESTION_TYPE_MULTIPLE_CHOICE],
                true_false: yieldEstimate?.trueFalseTarget ?? OBJECTIVE_TARGET_MIX[QUESTION_TYPE_TRUE_FALSE],
                fill_blank: yieldEstimate?.fillInTarget ?? OBJECTIVE_TARGET_MIX[QUESTION_TYPE_FILL_BLANK],
            },
            targetDifficultyDistribution: {
                easy: 0.25,
                medium: 0.5,
                hard: 0.25,
            },
            minDistinctOutcomeCount: Math.min(Math.max(1, outcomes.length), Math.max(2, Math.ceil(objectiveOutcomeKeys.length * 0.6))),
            items: objectivePlanItems,
        },
        multipleChoicePlan: {
            targetOutcomeKeys: multipleChoiceKeys,
        },
        trueFalsePlan: {
            targetOutcomeKeys: trueFalseKeys,
        },
        fillBlankPlan: {
            targetOutcomeKeys: fillBlankKeys,
            tokenBankRequired: true,
            exactAnswerOnly: true,
        },
        essayPlan: {
            targetOutcomeKeys: essayKeys,
            authenticScenarioRequired: essayKeys.length > 0,
            authenticContextHint: essayKeys.length > 0 ? "Use the provided topic evidence as the source of support." : undefined,
            minDistinctOutcomeCount: Math.min(Math.max(1, essayKeys.length), 2),
            minDistinctScenarioFrameCount: essayKeys.length > 1 ? 2 : 1,
            items: essayPlanItems,
        },
    });
};

export const resolveAssessmentQuestionType = ({ questionType, question }) => {
    const resolved = normalizeQuestionType(questionType || question?.questionType);
    if (resolved === QUESTION_TYPE_ESSAY) return QUESTION_TYPE_ESSAY;
    if (resolved === QUESTION_TYPE_TRUE_FALSE) return QUESTION_TYPE_TRUE_FALSE;
    if (resolved === QUESTION_TYPE_FILL_BLANK) return QUESTION_TYPE_FILL_BLANK;
    return QUESTION_TYPE_MULTIPLE_CHOICE;
};

export const getAssessmentPlanForQuestionType = (blueprint, questionType) => {
    const resolvedType = resolveAssessmentQuestionType({ questionType });
    const planKey = QUESTION_TYPE_PLAN_KEYS[resolvedType];
    return blueprint && typeof blueprint === "object" ? blueprint[planKey] || null : null;
};

export const getAllowedBloomLevelsForQuestionType = (questionType) =>
    QUESTION_TYPE_ALLOWED_BLOOM_LEVELS[resolveAssessmentQuestionType({ questionType })]
    || MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS;

export const topicUsesAssessmentBlueprint = (topic) =>
    String(topic?.assessmentBlueprint?.version || "").trim() === ASSESSMENT_BLUEPRINT_VERSION;

const countTemplateBlanks = (templateParts) =>
    (Array.isArray(templateParts) ? templateParts : []).filter((item) => item === "__").length;

export const getAssessmentQuestionMetadataIssues = ({
    question,
    blueprint,
    questionType,
}) => {
    const resolvedType = resolveAssessmentQuestionType({ questionType, question });
    const allowedBloomLevels = getAllowedBloomLevelsForQuestionType(resolvedType);
    const plan = getAssessmentPlanForQuestionType(blueprint, resolvedType);
    const outcomeKey = normalizeOutcomeKey(question?.outcomeKey);
    const bloomLevel = normalizeBloomLevel(question?.bloomLevel);
    const normalizedQuestionText = normalizeText(buildQuestionAlignmentText(question)).toLowerCase();
    const issues = [];

    if (!outcomeKey) {
        issues.push("missing outcomeKey");
    }
    if (!bloomLevel) {
        issues.push("missing bloomLevel");
    } else if (!allowedBloomLevels.includes(bloomLevel)) {
        issues.push(`invalid bloomLevel for ${resolvedType}`);
    }

    if (resolvedType === QUESTION_TYPE_FILL_BLANK) {
        const acceptedAnswers = Array.isArray(question?.acceptedAnswers)
            ? question.acceptedAnswers.map((item) => normalizeText(item)).filter(Boolean)
            : [];
        if (acceptedAnswers.length === 0) {
            issues.push("missing acceptedAnswers");
        }
        if (countTemplateBlanks(question?.templateParts) !== 1) {
            issues.push("fill_blank must contain exactly one blank");
        }
        if (String(question?.fillBlankMode || "").trim() === "token_bank") {
            const tokens = Array.isArray(question?.tokens)
                ? question.tokens.map((item) => normalizeText(item)).filter(Boolean)
                : [];
            if (tokens.length < 2) {
                issues.push("token_bank fill_blank missing tokens");
            }
        }
    }

    if (!plan || !Array.isArray(blueprint?.outcomes)) {
        if (resolvedType === QUESTION_TYPE_ESSAY && plan?.authenticScenarioRequired && !normalizeText(question?.authenticContext)) {
            issues.push("missing authenticContext");
        }
        return issues;
    }

    const outcome = blueprint.outcomes.find((item) => item?.key === outcomeKey);
    if (!outcome) {
        issues.push("unknown outcomeKey");
        return issues;
    }
    if (outcome.bloomLevel !== bloomLevel) {
        issues.push("bloomLevel does not match outcome");
    }
    if (
        Array.isArray(plan?.targetOutcomeKeys)
        && plan.targetOutcomeKeys.length > 0
        && !plan.targetOutcomeKeys.includes(outcomeKey)
    ) {
        issues.push(`outcomeKey not allowed for ${resolvedType}`);
    }
    if (resolvedType === QUESTION_TYPE_ESSAY && plan?.authenticScenarioRequired && !normalizeText(question?.authenticContext)) {
        issues.push("missing authenticContext");
    }

    const questionSignalsFractionAddition =
        /same denominator|add denominators|adding fractions|fraction addition|denominator stays the same/.test(normalizedQuestionText)
        || /[0-9]\s*\/\s*[0-9]\s*[+=-]\s*[0-9]\s*\/\s*[0-9]/.test(normalizedQuestionText);
    if (questionSignalsFractionAddition) {
        const outcomeText = normalizeText(
            `${outcome?.evidenceFocus || ""} ${outcome?.objective || ""} ${outcome?.scenarioFrame || ""}`
        ).toLowerCase();
        const outcomeSupportsFractionAddition =
            /same denominator|add denominators|adding fractions|fraction addition|denominator rule/.test(outcomeText)
            || /[0-9]\s*\/\s*[0-9]\s*[+=-]\s*[0-9]\s*\/\s*[0-9]/.test(outcomeText);
        if (!outcomeSupportsFractionAddition) {
            issues.push("outcomeKey weakly aligned to question");
        }
    }

    const assignedAlignmentScore = scoreOutcomeAlignment(question, outcome);
    const bestAligned = resolveBestAlignedOutcome({
        question,
        blueprint,
        questionType: resolvedType,
    });
    if (assignedAlignmentScore < 0.2) {
        issues.push("outcomeKey weakly aligned to question");
    }
    if (
        bestAligned?.outcome?.key
        && bestAligned.outcome.key !== outcomeKey
        && bestAligned.score >= assignedAlignmentScore + 0.18
    ) {
        issues.push(`question aligns better to ${bestAligned.outcome.key}`);
    }

    return issues;
};

export const isAssessmentV2Question = (question, { blueprint, questionType } = {}) => {
    if (String(question?.generationVersion || "").trim() !== ASSESSMENT_BLUEPRINT_VERSION) {
        return false;
    }
    return getAssessmentQuestionMetadataIssues({
        question,
        blueprint,
        questionType,
    }).length === 0;
};

export const filterQuestionsForActiveAssessment = ({ topic, questions }) => {
    const items = Array.isArray(questions) ? questions : [];
    const currentQuestionSetVersion = Number(topic?.questionSetVersion || 0);
    const activeQuestionSetItems = currentQuestionSetVersion > 0
        ? items.filter((question) => Number(question?.questionSetVersion || 0) === currentQuestionSetVersion)
        : items;

    if (!topicUsesAssessmentBlueprint(topic)) {
        return activeQuestionSetItems;
    }
    return activeQuestionSetItems.filter((question) =>
        isAssessmentV2Question(question, {
            blueprint: topic?.assessmentBlueprint,
            questionType: question?.questionType,
        })
    );
};
