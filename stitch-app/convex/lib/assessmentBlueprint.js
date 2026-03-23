export const ASSESSMENT_BLUEPRINT_VERSION = "assessment-blueprint-v1";

export const BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
];

export const MCQ_ALLOWED_BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
];

export const ESSAY_ALLOWED_BLOOM_LEVELS = [
    "Analyze",
    "Evaluate",
    "Create",
];

const BLOOM_LEVEL_INDEX = new Map(
    BLOOM_LEVELS.map((level) => [level.toLowerCase(), level])
);

const normalizeText = (value) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim();

export const normalizeBloomLevel = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    return BLOOM_LEVEL_INDEX.get(normalized) || "";
};

export const normalizeOutcomeKey = (value) =>
    normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

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
    };
};

const normalizePlanKeys = ({
    rawKeys,
    outcomeByKey,
    allowedBloomLevels,
    fallbackOutcomes,
}) => {
    const requestedKeys = uniqueStringArray(rawKeys).map((value) => normalizeOutcomeKey(value));
    const acceptedKeys = requestedKeys.filter((key) => {
        const outcome = outcomeByKey.get(key);
        return outcome && allowedBloomLevels.includes(outcome.bloomLevel);
    });
    if (acceptedKeys.length > 0) {
        return acceptedKeys;
    }
    return fallbackOutcomes
        .filter((outcome) => allowedBloomLevels.includes(outcome.bloomLevel))
        .map((outcome) => outcome.key);
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
    const rawMcqPlan = raw.mcqPlan && typeof raw.mcqPlan === "object" ? raw.mcqPlan : {};
    const rawEssayPlan = raw.essayPlan && typeof raw.essayPlan === "object" ? raw.essayPlan : {};

    const mcqTargetOutcomeKeys = normalizePlanKeys({
        rawKeys: rawMcqPlan.targetOutcomeKeys,
        outcomeByKey,
        allowedBloomLevels: MCQ_ALLOWED_BLOOM_LEVELS,
        fallbackOutcomes: normalizedOutcomes,
    });
    const essayTargetOutcomeKeys = normalizePlanKeys({
        rawKeys: rawEssayPlan.targetOutcomeKeys,
        outcomeByKey,
        allowedBloomLevels: ESSAY_ALLOWED_BLOOM_LEVELS,
        fallbackOutcomes: normalizedOutcomes,
    });

    if (mcqTargetOutcomeKeys.length === 0 || essayTargetOutcomeKeys.length === 0) {
        return null;
    }

    const mcqTargetBloomLevels = uniqueStringArray(
        mcqTargetOutcomeKeys.map((key) => outcomeByKey.get(key)?.bloomLevel)
    ).filter((level) => MCQ_ALLOWED_BLOOM_LEVELS.includes(level));
    const essayTargetBloomLevels = uniqueStringArray(
        essayTargetOutcomeKeys.map((key) => outcomeByKey.get(key)?.bloomLevel)
    ).filter((level) => ESSAY_ALLOWED_BLOOM_LEVELS.includes(level));

    return {
        version: ASSESSMENT_BLUEPRINT_VERSION,
        outcomes: normalizedOutcomes,
        mcqPlan: {
            allowedBloomLevels: [...MCQ_ALLOWED_BLOOM_LEVELS],
            targetBloomLevels: mcqTargetBloomLevels,
            targetOutcomeKeys: mcqTargetOutcomeKeys,
        },
        essayPlan: {
            allowedBloomLevels: [...ESSAY_ALLOWED_BLOOM_LEVELS],
            targetBloomLevels: essayTargetBloomLevels,
            targetOutcomeKeys: essayTargetOutcomeKeys,
            authenticScenarioRequired: rawEssayPlan.authenticScenarioRequired === true,
            authenticContextHint: normalizeText(
                rawEssayPlan.authenticContextHint || rawEssayPlan.authenticContext
            ) || undefined,
        },
    };
};

const resolveQuestionType = ({ questionType, question }) => {
    const normalized = normalizeText(questionType || question?.questionType).toLowerCase();
    if (normalized === "essay") return "essay";
    return "mcq";
};

export const topicUsesAssessmentBlueprint = (topic) =>
    String(topic?.assessmentBlueprint?.version || "").trim() === ASSESSMENT_BLUEPRINT_VERSION;

export const getAssessmentQuestionMetadataIssues = ({
    question,
    blueprint,
    questionType,
}) => {
    const resolvedType = resolveQuestionType({ questionType, question });
    const allowedBloomLevels =
        resolvedType === "essay" ? ESSAY_ALLOWED_BLOOM_LEVELS : MCQ_ALLOWED_BLOOM_LEVELS;
    const plan =
        blueprint && typeof blueprint === "object"
            ? resolvedType === "essay"
                ? blueprint.essayPlan
                : blueprint.mcqPlan
            : null;
    const outcomeKey = normalizeOutcomeKey(question?.outcomeKey);
    const bloomLevel = normalizeBloomLevel(question?.bloomLevel);
    const issues = [];

    if (!outcomeKey) {
        issues.push("missing outcomeKey");
    }
    if (!bloomLevel) {
        issues.push("missing bloomLevel");
    } else if (!allowedBloomLevels.includes(bloomLevel)) {
        issues.push(`invalid bloomLevel for ${resolvedType}`);
    }

    if (!plan || !Array.isArray(blueprint?.outcomes)) {
        if (resolvedType === "essay" && plan?.authenticScenarioRequired && !normalizeText(question?.authenticContext)) {
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
    if (resolvedType === "essay" && plan?.authenticScenarioRequired && !normalizeText(question?.authenticContext)) {
        issues.push("missing authenticContext");
    }

    return issues;
};

export const isAssessmentV1Question = (question, { blueprint, questionType } = {}) => {
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
    if (!topicUsesAssessmentBlueprint(topic)) {
        return items;
    }
    return items.filter((question) =>
        isAssessmentV1Question(question, {
            blueprint: topic?.assessmentBlueprint,
            questionType: question?.questionType,
        })
    );
};
