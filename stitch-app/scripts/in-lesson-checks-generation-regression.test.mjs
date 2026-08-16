import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAiCoursePayload } from "../server/aiCourseGeneration.js";
import { normalizeInLessonChecks } from "../server/inLessonChecks.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = [
  "## Key Ideas",
  "",
  "Cellular respiration converts glucose into usable energy. Glycolysis happens in the cytoplasm.",
  "",
  "## Worked Example",
  "",
  "Then the Krebs cycle oxidizes acetyl-CoA in the mitochondrial matrix. Finally the electron transport chain makes ATP.",
].join("\n");

const quizQuestions = [
  {
    prompt: "Where does glycolysis break glucose into pyruvate?",
    options: ["the cytoplasm", "the nucleus", "the cell wall", "the Golgi body"],
    correctIndex: 0,
    explanation: "Glycolysis happens in the cytoplasm.",
  },
];

const inLessonChecks = normalizeInLessonChecks(
  [
    {
      sectionTitle: "Key Ideas",
      questionType: "multiple_choice",
      prompt: "What does cellular respiration convert glucose into?",
      options: ["usable energy", "cellulose", "starch grains", "the cell wall"],
      correctIndex: 0,
      explanation: "Cellular respiration converts glucose into usable energy.",
    },
    {
      sectionTitle: "Worked Example",
      questionType: "true_false",
      prompt: "The Krebs cycle oxidizes acetyl-CoA in the mitochondrial matrix.",
      options: ["True", "False"],
      correctIndex: 0,
      explanation: "The worked example places Krebs in the mitochondrial matrix.",
    },
  ],
  {
    content,
    title: "Cellular respiration",
    quizPrompts: quizQuestions.map((question) => question.prompt),
  },
);

assert.equal(inLessonChecks.length, 2, "two H2 sections should yield two in-lesson checks");
assert.ok(inLessonChecks.every((check) => check.surface === "in_lesson"));
assert.equal(inLessonChecks[0].sectionTitle, "Key Ideas");
assert.equal(inLessonChecks[1].sectionTitle, "Worked Example");
assert.ok(inLessonChecks.every((check) => check.questionType !== "ordering" || check.payload?.stepsInOrder));

const normalized = normalizeAiCoursePayload(
  {
    topics: [
      {
        title: "Cellular respiration",
        description: "Energy from glucose",
        content,
        questions: quizQuestions,
        inLessonChecks,
      },
    ],
  },
  { fileName: "krebs.pdf", extractedText: content },
);

assert.equal(normalized.topics[0].questions.length, 1, "quiz MCQs must stay separate from in-lesson checks");
assert.ok(normalized.topics[0].questions.every((question) => question.surface === "quiz"));
assert.equal(normalized.topics[0].inLessonChecks.length, 2);
assert.ok(normalized.topics[0].inLessonChecks.every((check) => check.surface === "in_lesson"));

const courses = await fs.readFile(path.join(root, "server/courses.js"), "utf8");
const exams = await fs.readFile(path.join(root, "server/exams.js"), "utf8");
assert.match(courses, /surface, 'quiz'\) = 'quiz'/, "topic quizzes must exclude in-lesson rows");
assert.match(exams, /surface, 'quiz'\) = 'quiz'/, "timed exams must exclude in-lesson and ordering rows");
assert.doesNotMatch(
  exams,
  /question_type = 'ordering'/,
  "exams must not select ordering questions",
);

console.log("in-lesson-checks-generation-regression.test.mjs passed");
