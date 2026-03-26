"use node";

import { QUESTION_TYPE_FILL_BLANK, QUESTION_TYPE_MULTIPLE_CHOICE, QUESTION_TYPE_TRUE_FALSE } from "./objectiveExam.js";

export const resolveGroundedContentType = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
        return QUESTION_TYPE_MULTIPLE_CHOICE;
    }
    if (normalized === "mcq" || normalized === QUESTION_TYPE_MULTIPLE_CHOICE) {
        return QUESTION_TYPE_MULTIPLE_CHOICE;
    }
    if (normalized === QUESTION_TYPE_TRUE_FALSE) {
        return QUESTION_TYPE_TRUE_FALSE;
    }
    if (normalized === QUESTION_TYPE_FILL_BLANK) {
        return QUESTION_TYPE_FILL_BLANK;
    }
    if (normalized === "essay" || normalized === "concept") {
        return normalized;
    }
    return QUESTION_TYPE_MULTIPLE_CHOICE;
};
