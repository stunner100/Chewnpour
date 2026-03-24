export const OBJECTIVE_EXAM_FORMAT = 'objective';
export const ESSAY_EXAM_FORMAT = 'essay';

export const QUESTION_TYPE_MULTIPLE_CHOICE = 'multiple_choice';
export const QUESTION_TYPE_TRUE_FALSE = 'true_false';
export const QUESTION_TYPE_FILL_BLANK = 'fill_blank';
export const QUESTION_TYPE_ESSAY = 'essay';
export const OBJECTIVE_TARGET_MIX = {
    [QUESTION_TYPE_MULTIPLE_CHOICE]: 5,
    [QUESTION_TYPE_TRUE_FALSE]: 3,
    [QUESTION_TYPE_FILL_BLANK]: 2,
};

export const normalizeExamFormat = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === ESSAY_EXAM_FORMAT) return ESSAY_EXAM_FORMAT;
    if (normalized === OBJECTIVE_EXAM_FORMAT || normalized === 'mcq') return OBJECTIVE_EXAM_FORMAT;
    return OBJECTIVE_EXAM_FORMAT;
};

export const normalizeQuestionType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === QUESTION_TYPE_ESSAY || normalized === 'essay') return QUESTION_TYPE_ESSAY;
    if (
        normalized === QUESTION_TYPE_TRUE_FALSE
        || normalized === 'true false'
        || normalized === 'true/false'
        || normalized === 'true-false'
    ) {
        return QUESTION_TYPE_TRUE_FALSE;
    }
    if (
        normalized === QUESTION_TYPE_FILL_BLANK
        || normalized === 'fill in the blank'
        || normalized === 'fill-in-the-blank'
        || normalized === 'fill in'
    ) {
        return QUESTION_TYPE_FILL_BLANK;
    }
    if (
        normalized === QUESTION_TYPE_MULTIPLE_CHOICE
        || normalized === 'multiple choice'
        || normalized === 'mcq'
    ) {
        return QUESTION_TYPE_MULTIPLE_CHOICE;
    }
    return QUESTION_TYPE_MULTIPLE_CHOICE;
};

export const isEssayFormat = (value) => normalizeExamFormat(value) === ESSAY_EXAM_FORMAT;
export const isEssayQuestionType = (value) => normalizeQuestionType(value) === QUESTION_TYPE_ESSAY;

export const getObjectiveSubtypeTargets = (objectiveTargetCount = 10) => {
    const safeCount = Math.max(1, Math.round(Number(objectiveTargetCount || 10)));
    if (safeCount === 10) {
        return { ...OBJECTIVE_TARGET_MIX };
    }

    const baseTotal = 10;
    const scaled = {
        [QUESTION_TYPE_MULTIPLE_CHOICE]: 1,
        [QUESTION_TYPE_TRUE_FALSE]: 1,
        [QUESTION_TYPE_FILL_BLANK]: 1,
    };
    let assigned = 0;
    for (const [questionType, count] of Object.entries(OBJECTIVE_TARGET_MIX)) {
        const rounded = Math.max(1, Math.floor((count / baseTotal) * safeCount));
        scaled[questionType] = rounded;
        assigned += rounded;
    }

    while (assigned < safeCount) {
        const nextType = Object.keys(OBJECTIVE_TARGET_MIX)
            .sort((left, right) => OBJECTIVE_TARGET_MIX[right] - OBJECTIVE_TARGET_MIX[left])[0];
        scaled[nextType] += 1;
        assigned += 1;
    }

    while (assigned > safeCount) {
        const nextType = Object.keys(OBJECTIVE_TARGET_MIX)
            .sort((left, right) => scaled[right] - scaled[left])[0];
        if (scaled[nextType] <= 1) break;
        scaled[nextType] -= 1;
        assigned -= 1;
    }

    return scaled;
};

export const objectiveBreakdownMeetsTargets = (breakdown, objectiveTargetCount = 10) => {
    const safeBreakdown = breakdown && typeof breakdown === 'object' ? breakdown : {};
    const targets = getObjectiveSubtypeTargets(objectiveTargetCount);
    return Object.entries(targets).every(([questionType, targetCount]) => (
        Number(safeBreakdown[questionType] || 0) >= Number(targetCount || 0)
    ));
};
