"use node";

export const OBJECTIVE_EXAM_FORMAT = "objective";
export const ESSAY_EXAM_FORMAT = "essay";

export const QUESTION_TYPE_MULTIPLE_CHOICE = "multiple_choice";
export const QUESTION_TYPE_TRUE_FALSE = "true_false";
export const QUESTION_TYPE_FILL_BLANK = "fill_blank";
export const QUESTION_TYPE_ESSAY = "essay";

export const OBJECTIVE_QUESTION_TYPES = [
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
    QUESTION_TYPE_FILL_BLANK,
];

export const OBJECTIVE_TARGET_MIX = {
    [QUESTION_TYPE_MULTIPLE_CHOICE]: 5,
    [QUESTION_TYPE_TRUE_FALSE]: 3,
    [QUESTION_TYPE_FILL_BLANK]: 2,
};

export const DEFAULT_OBJECTIVE_TARGET_COUNT = Object.values(OBJECTIVE_TARGET_MIX)
    .reduce((sum, count) => sum + Number(count || 0), 0);
export const DEFAULT_ESSAY_TARGET_COUNT = 2;

const normalizeText = (value) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

export const normalizeQuestionType = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) return QUESTION_TYPE_MULTIPLE_CHOICE;
    if (normalized === "essay") return QUESTION_TYPE_ESSAY;
    if (
        normalized === "multiple_choice"
        || normalized === "multiple choice"
        || normalized === "mcq"
    ) {
        return QUESTION_TYPE_MULTIPLE_CHOICE;
    }
    if (
        normalized === "true_false"
        || normalized === "true false"
        || normalized === "true/false"
        || normalized === "true-false"
    ) {
        return QUESTION_TYPE_TRUE_FALSE;
    }
    if (
        normalized === "fill_blank"
        || normalized === "fill in the blank"
        || normalized === "fill-in-the-blank"
        || normalized === "fill in"
        || normalized === "fill-in"
    ) {
        return QUESTION_TYPE_FILL_BLANK;
    }
    return normalized;
};

export const isEssayQuestionType = (value) =>
    normalizeQuestionType(value) === QUESTION_TYPE_ESSAY;

export const isObjectiveQuestionType = (value) =>
    OBJECTIVE_QUESTION_TYPES.includes(normalizeQuestionType(value));

export const normalizeExamFormat = (value) => {
    const normalized = normalizeText(value);
    if (normalized === ESSAY_EXAM_FORMAT) return ESSAY_EXAM_FORMAT;
    if (normalized === OBJECTIVE_EXAM_FORMAT || normalized === "mcq") {
        return OBJECTIVE_EXAM_FORMAT;
    }
    return OBJECTIVE_EXAM_FORMAT;
};

export const createEmptyObjectiveBreakdown = () => ({
    [QUESTION_TYPE_MULTIPLE_CHOICE]: 0,
    [QUESTION_TYPE_TRUE_FALSE]: 0,
    [QUESTION_TYPE_FILL_BLANK]: 0,
});

export const normalizeObjectiveBreakdown = (value) => {
    const safeValue = value && typeof value === "object" ? value : {};
    const breakdown = createEmptyObjectiveBreakdown();
    for (const questionType of OBJECTIVE_QUESTION_TYPES) {
        const numeric = Number(safeValue[questionType] || 0);
        breakdown[questionType] = Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
    }
    return breakdown;
};

export const countObjectiveQuestionBreakdown = (questions, predicate = () => true) => {
    const breakdown = createEmptyObjectiveBreakdown();
    for (const question of Array.isArray(questions) ? questions : []) {
        if (!predicate(question)) continue;
        const questionType = normalizeQuestionType(question?.questionType);
        if (!OBJECTIVE_QUESTION_TYPES.includes(questionType)) continue;
        breakdown[questionType] += 1;
    }
    return breakdown;
};

export const resolveObjectiveTargetCount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_OBJECTIVE_TARGET_COUNT;
    }
    return Math.max(1, Math.round(numeric));
};

export const resolveEssayTargetCount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_ESSAY_TARGET_COUNT;
    }
    return Math.max(1, Math.round(numeric));
};

export const getObjectiveSubtypeTargets = (objectiveTargetCount = DEFAULT_OBJECTIVE_TARGET_COUNT) => {
    const safeObjectiveTarget = Math.max(1, Math.round(Number(objectiveTargetCount || DEFAULT_OBJECTIVE_TARGET_COUNT)));
    if (safeObjectiveTarget === DEFAULT_OBJECTIVE_TARGET_COUNT) {
        return { ...OBJECTIVE_TARGET_MIX };
    }

    const baseTotal = DEFAULT_OBJECTIVE_TARGET_COUNT;
    const scaled = createEmptyObjectiveBreakdown();
    const rawTargets = {};
    let assigned = 0;
    for (const questionType of OBJECTIVE_QUESTION_TYPES) {
        const raw = (OBJECTIVE_TARGET_MIX[questionType] / baseTotal) * safeObjectiveTarget;
        rawTargets[questionType] = raw;
        const rounded = Math.max(0, Math.floor(raw));
        scaled[questionType] = rounded;
        assigned += rounded;
    }

    if (assigned === 0) {
        scaled[QUESTION_TYPE_MULTIPLE_CHOICE] = 1;
        assigned = 1;
    }

    while (assigned < safeObjectiveTarget) {
        const nextType = OBJECTIVE_QUESTION_TYPES
            .slice()
            .sort((left, right) => {
                const leftGap = Number(rawTargets[left] || 0) - scaled[left];
                const rightGap = Number(rawTargets[right] || 0) - scaled[right];
                return rightGap - leftGap;
            })[0];
        scaled[nextType] += 1;
        assigned += 1;
    }

    return scaled;
};

export const objectiveBreakdownMeetsTargets = (breakdown, objectiveTargetCount) => {
    const normalizedBreakdown = normalizeObjectiveBreakdown(breakdown);
    const targets = getObjectiveSubtypeTargets(objectiveTargetCount);
    return OBJECTIVE_QUESTION_TYPES.every(
        (questionType) => normalizedBreakdown[questionType] >= targets[questionType]
    );
};
