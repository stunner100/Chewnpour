import {
    OBJECTIVE_TARGET_MIX,
    QUESTION_TYPE_ESSAY,
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
    normalizeQuestionType,
} from "./objectiveExam.js";

export const ASSESSMENT_BLUEPRINT_VERSION = "assessment-blueprint-v2";

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

export const TRUE_FALSE_ALLOWED_BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
];

export const FILL_BLANK_ALLOWED_BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
];

export const ESSAY_ALLOWED_BLOOM_LEVELS = [
    "Analyze",
    "Evaluate",
    "Create",
];

export const MCQ_ALLOWED_BLOOM_LEVELS = MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS;

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

const normalizeSubtypePlan = ({
    rawPlan,
    outcomeByKey,
    fallbackOutcomes,
    allowedBloomLevels,
    extraFields = {},
}) => {
    const targetOutcomeKeys = normalizePlanKeys({
        rawKeys: rawPlan?.targetOutcomeKeys,
        outcomeByKey,
        allowedBloomLevels,
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
    });
    const trueFalsePlan = normalizeSubtypePlan({
        rawPlan: rawTrueFalsePlan,
        outcomeByKey,
        fallbackOutcomes: normalizedOutcomes,
        allowedBloomLevels: TRUE_FALSE_ALLOWED_BLOOM_LEVELS,
    });
    const fillBlankPlan = normalizeSubtypePlan({
        rawPlan: rawFillBlankPlan,
        outcomeByKey,
        fallbackOutcomes: normalizedOutcomes,
        allowedBloomLevels: FILL_BLANK_ALLOWED_BLOOM_LEVELS,
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
            targetMix: { ...OBJECTIVE_TARGET_MIX },
            targetOutcomeKeys: objectiveOutcomeKeys,
            targetBloomLevels: objectiveTargetBloomLevels,
        },
        multipleChoicePlan,
        trueFalsePlan,
        fillBlankPlan,
        essayPlan,
    };
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
    if (!topicUsesAssessmentBlueprint(topic)) {
        return items;
    }
    return items.filter((question) =>
        isAssessmentV2Question(question, {
            blueprint: topic?.assessmentBlueprint,
            questionType: question?.questionType,
        })
    );
};
