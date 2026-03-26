import assert from "node:assert/strict";

import { selectQuestionsForAttempt } from "../convex/lib/examQuestionSelection.js";
import {
    OBJECTIVE_EXAM_FORMAT,
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
    getObjectiveSubtypeTargets,
    objectiveBreakdownMeetsTargets,
} from "../convex/lib/objectiveExam.js";

const makeMcq = (index) => ({
    _id: `mcq-${index}`,
    topicId: "topic-1",
    questionType: QUESTION_TYPE_MULTIPLE_CHOICE,
    questionText: `Objective prompt about ${[
        "volcanoes",
        "estuaries",
        "archives",
        "enzymes",
        "federalism",
        "logarithms",
    ][index - 1]}?`,
    difficulty: "medium",
    options: [
        { label: "A", text: `Wrong ${index}-1`, isCorrect: false },
        { label: "B", text: `Correct ${index}`, isCorrect: true },
        { label: "C", text: `Wrong ${index}-2`, isCorrect: false },
        { label: "D", text: `Wrong ${index}-3`, isCorrect: false },
    ],
    correctAnswer: "B",
    outcomeKey: "outcome-1",
    bloomLevel: "Understand",
});

const makeTrueFalse = (index) => ({
    _id: `tf-${index}`,
    topicId: "topic-1",
    questionType: QUESTION_TYPE_TRUE_FALSE,
    questionText: `True or false claim about ${[
        "coastal erosion",
        "curriculum alignment",
        "market liberalization",
        "cell respiration",
    ][index - 1]}.`,
    difficulty: "medium",
    options: [
        { label: "A", text: "True", isCorrect: index % 2 === 0 },
        { label: "B", text: "False", isCorrect: index % 2 !== 0 },
    ],
    correctAnswer: index % 2 === 0 ? "A" : "B",
    outcomeKey: "outcome-1",
    bloomLevel: "Understand",
});

const makeFillBlank = (index) => ({
    _id: `fb-${index}`,
    topicId: "topic-1",
    questionType: QUESTION_TYPE_FILL_BLANK,
    questionText: `Fill the blank about ${[
        "meteorology",
        "budget variance",
        "constitutional law",
    ][index - 1]}.`,
    difficulty: "medium",
    templateParts: [`Prompt ${index} `, "__", "."],
    acceptedAnswers: [`answer-${index}`],
    correctAnswer: `answer-${index}`,
    fillBlankMode: index % 2 === 0 ? "token_bank" : "free_text",
    tokens: index % 2 === 0 ? [`answer-${index}`, `wrong-${index}-1`, `wrong-${index}-2`, `wrong-${index}-3`] : undefined,
    outcomeKey: "outcome-1",
    bloomLevel: "Understand",
});

const assessmentBlueprint = {
    outcomes: [
        {
            key: "outcome-1",
            objective: "Recall core facts from the lesson.",
            bloomLevel: "Understand",
            evidenceFocus: "Use explicit statements from the source material.",
        },
        {
            key: "outcome-essay",
            objective: "Explain the lesson with evidence and reasoning.",
            bloomLevel: "Analyze",
            evidenceFocus: "Synthesize the source material into a short explanation.",
        },
    ],
    multipleChoicePlan: {
        targetOutcomeKeys: ["outcome-1"],
    },
    trueFalsePlan: {
        targetOutcomeKeys: ["outcome-1"],
    },
    fillBlankPlan: {
        targetOutcomeKeys: ["outcome-1"],
    },
    essayPlan: {
        targetOutcomeKeys: ["outcome-essay"],
    },
};

const objectiveBank = [
    ...Array.from({ length: 6 }, (_, index) => makeMcq(index + 1)),
    ...Array.from({ length: 4 }, (_, index) => makeTrueFalse(index + 1)),
    ...Array.from({ length: 3 }, (_, index) => makeFillBlank(index + 1)),
];

const firstAttemptSelection = selectQuestionsForAttempt({
    questions: objectiveBank,
    recentAttempts: [],
    subsetSize: 10,
    isEssay: false,
    examFormat: OBJECTIVE_EXAM_FORMAT,
    assessmentBlueprint,
    bankTargetCount: 10,
});

assert.equal(firstAttemptSelection.selectedQuestions.length, 10);
assert.equal(firstAttemptSelection.requiresGeneration, false);

const breakdown = firstAttemptSelection.selectedQuestions.reduce(
    (acc, question) => {
        acc[question.questionType] = (acc[question.questionType] || 0) + 1;
        return acc;
    },
    {}
);

assert.equal(breakdown[QUESTION_TYPE_MULTIPLE_CHOICE], 5);
assert.equal(breakdown[QUESTION_TYPE_TRUE_FALSE], 3);
assert.equal(breakdown[QUESTION_TYPE_FILL_BLANK], 2);
assert.equal(objectiveBreakdownMeetsTargets(breakdown, 10), true);
assert.equal(
    objectiveBreakdownMeetsTargets(
        {
            [QUESTION_TYPE_MULTIPLE_CHOICE]: 5,
            [QUESTION_TYPE_TRUE_FALSE]: 2,
            [QUESTION_TYPE_FILL_BLANK]: 3,
        },
        10
    ),
    false
);

assert.deepEqual(
    getObjectiveSubtypeTargets(2),
    {
        [QUESTION_TYPE_MULTIPLE_CHOICE]: 1,
        [QUESTION_TYPE_TRUE_FALSE]: 1,
        [QUESTION_TYPE_FILL_BLANK]: 0,
    },
    "Small objective targets should not require every subtype."
);
assert.deepEqual(
    getObjectiveSubtypeTargets(1),
    {
        [QUESTION_TYPE_MULTIPLE_CHOICE]: 1,
        [QUESTION_TYPE_TRUE_FALSE]: 0,
        [QUESTION_TYPE_FILL_BLANK]: 0,
    },
    "Single-question objective targets should fall back to one multiple-choice item."
);

const seenAttemptSelection = selectQuestionsForAttempt({
    questions: objectiveBank,
    recentAttempts: [
        {
            examFormat: OBJECTIVE_EXAM_FORMAT,
            questionIds: objectiveBank.slice(0, 10).map((question) => question._id),
            answers: objectiveBank.slice(0, 10).map((question) => ({ questionId: question._id })),
        },
    ],
    subsetSize: 10,
    isEssay: false,
    examFormat: OBJECTIVE_EXAM_FORMAT,
    assessmentBlueprint,
    bankTargetCount: 10,
});

assert.equal(seenAttemptSelection.selectedQuestions.length, 10);
assert.equal(seenAttemptSelection.completedAttemptCount, 1);

console.log("objective-selection-regression.test.mjs passed");
