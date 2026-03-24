import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
    evaluateDeterministicObjectiveAnswer,
    getAcceptedFillBlankAnswers,
    resolveObjectiveCorrectAnswer,
} from "../convex/lib/objectiveAnswerGrading.js";

const root = process.cwd();
const read = async (relativePath) =>
    fs.readFile(path.join(root, relativePath), "utf8");

const multipleChoiceQuestion = {
    questionType: "multiple_choice",
    correctAnswer: "B",
    options: [
        { label: "A", text: "Option one", isCorrect: false },
        { label: "B", text: "Option two", isCorrect: true },
        { label: "C", text: "Option three", isCorrect: false },
        { label: "D", text: "Option four", isCorrect: false },
    ],
};

const trueFalseQuestion = {
    questionType: "true_false",
    options: [
        { label: "A", text: "True", isCorrect: false },
        { label: "B", text: "False", isCorrect: true },
    ],
};

const tokenBankFillBlankQuestion = {
    questionType: "fill_blank",
    fillBlankMode: "token_bank",
    acceptedAnswers: ["Accra", "accra"],
    templateParts: ["The capital of Ghana is ", "__", "."],
    correctAnswer: "Accra",
};

const freeTextFillBlankQuestion = {
    questionType: "fill_blank",
    fillBlankMode: "free_text",
    acceptedAnswers: ["constructive alignment"],
    templateParts: ["Assessment design should reflect ", "__", "."],
    correctAnswer: "constructive alignment",
};

assert.deepEqual(getAcceptedFillBlankAnswers(tokenBankFillBlankQuestion), ["Accra", "accra"]);
assert.equal(resolveObjectiveCorrectAnswer(multipleChoiceQuestion), "B");
assert.equal(resolveObjectiveCorrectAnswer(trueFalseQuestion), "B");
assert.equal(resolveObjectiveCorrectAnswer(tokenBankFillBlankQuestion), "Accra");

const multipleChoiceResult = evaluateDeterministicObjectiveAnswer({
    question: multipleChoiceQuestion,
    selectedAnswer: "Option two",
});
assert.equal(multipleChoiceResult.isCorrect, true);
assert.equal(multipleChoiceResult.shouldAiGrade, false);
assert.equal(multipleChoiceResult.selectedAnswer, "B");

const trueFalseResult = evaluateDeterministicObjectiveAnswer({
    question: trueFalseQuestion,
    selectedAnswer: "False",
});
assert.equal(trueFalseResult.isCorrect, true);
assert.equal(trueFalseResult.selectedAnswer, "B");

const tokenBankFillBlankResult = evaluateDeterministicObjectiveAnswer({
    question: tokenBankFillBlankQuestion,
    selectedAnswer: "accra",
});
assert.equal(tokenBankFillBlankResult.isCorrect, true);
assert.equal(tokenBankFillBlankResult.shouldAiGrade, false);

const freeTextFillBlankResult = evaluateDeterministicObjectiveAnswer({
    question: freeTextFillBlankQuestion,
    selectedAnswer: "alignment of instruction",
});
assert.equal(freeTextFillBlankResult.isCorrect, false);
assert.equal(freeTextFillBlankResult.shouldAiGrade, true);
assert.equal(freeTextFillBlankResult.correctAnswer, "constructive alignment");

const examsSource = await read("convex/exams.ts");
const aiSource = await read("convex/ai.ts");

if (!examsSource.includes("evaluateDeterministicObjectiveAnswer")) {
    throw new Error("Expected objective exam submission to use deterministic answer grading.");
}

if (!examsSource.includes("ctx.runAction(internal.ai.gradeFillBlankAnswer")) {
    throw new Error("Expected free-text fill-blank submission to call the AI-assisted grading action.");
}

if (!examsSource.includes('code: "OBJECTIVE_SUBMISSION_INVALID"')) {
    throw new Error("Expected objective submission to reject essay-mode attempts.");
}

if (!aiSource.includes("export const gradeFillBlankAnswer = internalAction({")) {
    throw new Error("Expected ai.ts to expose an internal fill-blank grading action.");
}

console.log("objective-answer-grading-regression.test.mjs passed");
