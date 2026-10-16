import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAiCoursePayload } from "../server/aiCourseGeneration.js";
import { normalizeInLessonChecks } from "../server/inLessonChecks.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const lesson = {
  hook: "",
  sections: [
    {
      title: "How cells turn glucose into energy",
      role: "core",
      body: "Cellular respiration converts glucose into usable energy. Glycolysis happens in the cytoplasm.",
    },
    {
      title: "The stages in order",
      role: "steps",
      body: "First, glycolysis breaks glucose into pyruvate. Then the Krebs cycle oxidizes acetyl-CoA in the mitochondrial matrix. Finally the electron transport chain makes ATP.",
    },
  ],
  recap: [],
  wordBank: [],
};
const sourceText = lesson.sections.map((section) => section.body).join("\n\n");

const quizQuestions = [
  {
    prompt: "Where does glycolysis break glucose into pyruvate?",
    options: ["the cytoplasm", "the nucleus", "the cell wall", "the Golgi body"],
    correctIndex: 0,
    explanation: "Glycolysis happens in the cytoplasm.",
  },
];

const rawChecks = [
  {
    sectionIndex: 0,
    questionType: "multiple_choice",
    prompt: "What does cellular respiration convert glucose into?",
    options: ["usable energy", "cellulose", "starch grains", "the cell wall"],
    correctIndex: 0,
    explanation: "Cellular respiration converts glucose into usable energy.",
  },
  {
    sectionIndex: 1,
    questionType: "true_false",
    prompt: "The Krebs cycle oxidizes acetyl-CoA in the mitochondrial matrix.",
    options: ["True", "False"],
    correctIndex: 0,
    explanation: "The steps place Krebs in the mitochondrial matrix.",
  },
  {
    sectionIndex: 7,
    questionType: "true_false",
    prompt: "Glycolysis happens inside the nucleus of the cell.",
    options: ["True", "False"],
    correctIndex: 1,
  },
  {
    questionType: "true_false",
    prompt: "Electron transport is the stage that makes the ATP.",
    options: ["True", "False"],
    correctIndex: 0,
  },
];

const inLessonChecks = normalizeInLessonChecks(rawChecks, {
  lesson,
  title: "Cellular respiration",
  quizPrompts: quizQuestions.map((question) => question.prompt),
});

assert.equal(inLessonChecks.length, 2, "only checks naming a real section are kept (M7: unknown or missing sectionIndex is dropped)");
assert.ok(inLessonChecks.every((check) => check.surface === "in_lesson"));
assert.deepEqual(inLessonChecks.map((check) => check.sectionIndex), [0, 1]);
assert.deepEqual(inLessonChecks.map((check) => check.payload.sectionIndex), [0, 1]);

// An ordering check without a sectionIndex binds to the steps section.
const withOrdering = normalizeInLessonChecks([rawChecks[0]], {
  lesson,
  title: "Cellular respiration",
  ordering: {
    prompt: "Order the stages of cellular respiration.",
    stepsInOrder: ["glycolysis breaks glucose into pyruvate", "the Krebs cycle oxidizes acetyl-CoA", "the electron transport chain makes ATP"],
  },
});
assert.deepEqual(withOrdering.map((check) => [check.questionType, check.sectionIndex]), [["multiple_choice", 0], ["ordering", 1]]);

const normalized = normalizeAiCoursePayload(
  {
    topics: [
      {
        title: "Cellular respiration",
        description: "Energy from glucose",
        lesson,
        questions: quizQuestions,
        inLessonChecks: rawChecks,
      },
    ],
  },
  { fileName: "krebs.pdf", extractedText: sourceText },
);

assert.equal(normalized.topics[0].questions.length, 1, "quiz MCQs must stay separate from in-lesson checks");
assert.ok(normalized.topics[0].questions.every((question) => question.surface === "quiz"));
assert.equal(normalized.topics[0].inLessonChecks.length, 2);
assert.ok(normalized.topics[0].inLessonChecks.every((check) => check.surface === "in_lesson"));

const courses = await fs.readFile(path.join(root, "server/courses.js"), "utf8");
const exams = await fs.readFile(path.join(root, "server/exams.js"), "utf8");
assert.match(courses, /surface, 'quiz'\) = 'quiz'/, "topic quizzes must exclude in-lesson rows");
assert.match(exams, /surface, 'quiz'\) IN \('quiz', 'exam'\)/, "timed exams must exclude in-lesson and ordering rows");
assert.doesNotMatch(
  exams,
  /question_type = 'ordering'/,
  "exams must not select ordering questions",
);

console.log("in-lesson-checks-generation-regression.test.mjs passed");
