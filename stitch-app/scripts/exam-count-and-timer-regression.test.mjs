import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const examsPath = path.join(root, "convex", "exams.ts");
const examModePath = path.join(root, "src", "pages", "ExamMode.jsx");
const aiPath = path.join(root, "convex", "ai.ts");

const [examsSource, examModeSource, aiSource] = await Promise.all([
  fs.readFile(examsPath, "utf8"),
  fs.readFile(examModePath, "utf8"),
  fs.readFile(aiPath, "utf8"),
]);

if (!/const EXAM_QUESTION_SUBSET_SIZE = 35;/.test(examsSource)) {
  throw new Error("Expected convex/exams.ts to set MCQ exam cap to 35.");
}

if (!/const EXAM_ESSAY_QUESTION_SUBSET_SIZE = 15;/.test(examsSource)) {
  throw new Error("Expected convex/exams.ts to set essay exam cap to 15.");
}

if (!/const EXAM_DURATION_SECONDS = 45 \* 60;/.test(examModeSource)) {
  throw new Error("Expected src/pages/ExamMode.jsx to use EXAM_DURATION_SECONDS = 45 * 60.");
}

if (/25-question test/i.test(examModeSource)) {
  throw new Error("Expected src/pages/ExamMode.jsx to remove hardcoded 25-question loading copy.");
}

if (!/const ESSAY_EXAM_QUESTION_CAP = 15;/.test(examModeSource)) {
  throw new Error("Expected ExamMode to define ESSAY_EXAM_QUESTION_CAP as 15.");
}

if (/ESSAY_EXAM_INTERACTIVE_START_COUNT/.test(examModeSource) || /generateEssayQuestions\(\{/.test(examModeSource)) {
  throw new Error("Regression detected: ExamMode should not pre-generate essay questions from the format picker.");
}

if (!/const ESSAY_QUESTION_TARGET_MAX_COUNT = 15;/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to allow the essay generator to satisfy the full 15-question exam cap.");
}

console.log("exam-count-and-timer-regression.test.mjs passed");
