import assert from "node:assert/strict";
import { resolveGroundedContentType } from "../convex/lib/groundedContentType.js";
import {
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
} from "../convex/lib/objectiveExam.js";

assert.equal(
    resolveGroundedContentType("mcq"),
    QUESTION_TYPE_MULTIPLE_CHOICE,
    "MCQ exam-format shorthands must map to the grounded multiple_choice verifier type."
);

assert.equal(
    resolveGroundedContentType(QUESTION_TYPE_MULTIPLE_CHOICE),
    QUESTION_TYPE_MULTIPLE_CHOICE,
    "Existing multiple_choice values should remain unchanged."
);

assert.equal(
    resolveGroundedContentType(QUESTION_TYPE_TRUE_FALSE),
    QUESTION_TYPE_TRUE_FALSE,
    "True/false content types should remain unchanged."
);

assert.equal(
    resolveGroundedContentType(QUESTION_TYPE_FILL_BLANK),
    QUESTION_TYPE_FILL_BLANK,
    "Fill-blank content types should remain unchanged."
);

assert.equal(
    resolveGroundedContentType("essay"),
    "essay",
    "Essay content types should remain unchanged."
);

console.log("grounded-content-type-regression.test.mjs passed");
