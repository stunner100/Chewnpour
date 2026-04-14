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

if (!/const EXAM_OBJECTIVE_DEFAULT_COUNT = 10;/.test(examsSource)) {
  throw new Error("Expected convex/exams.ts to default fresh objective exams to 10 questions.");
}

if (!/const EXAM_ESSAY_DEFAULT_COUNT = 1;/.test(examsSource)) {
  throw new Error("Expected convex/exams.ts to default fresh essay exams to 1 question.");
}

if (!/const EXAM_DURATION_SECONDS = 45 \* 60;/.test(examModeSource)) {
  throw new Error("Expected src/pages/ExamMode.jsx to use EXAM_DURATION_SECONDS = 45 * 60.");
}

if (/25-question test/i.test(examModeSource)) {
  throw new Error("Expected src/pages/ExamMode.jsx to remove hardcoded 25-question loading copy.");
}

if (/ESSAY_EXAM_QUESTION_CAP/.test(examModeSource) || /Preparing a full essay exam/i.test(examModeSource)) {
  throw new Error("Regression detected: ExamMode should no longer expose prebuilt-bank essay cap/deferred copy.");
}

if (!/const FRESH_CONTEXT_OBJECTIVE_DEFAULT_COUNT = 10;/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to define the fresh objective default count.");
}

if (!/const FRESH_CONTEXT_ESSAY_DEFAULT_COUNT = 1;/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to define the fresh essay default count.");
}

console.log("exam-count-and-timer-regression.test.mjs passed");
