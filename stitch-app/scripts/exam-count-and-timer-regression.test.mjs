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

if (/EXAM_QUESTION_SUBSET_SIZE|EXAM_ESSAY_QUESTION_SUBSET_SIZE/.test(examsSource)) {
  throw new Error("Regression detected: convex/exams.ts should no longer hardcode fixed exam subset sizes.");
}

if (!/const EXAM_DURATION_SECONDS = 45 \* 60;/.test(examModeSource)) {
  throw new Error("Expected src/pages/ExamMode.jsx to use EXAM_DURATION_SECONDS = 45 * 60.");
}

if (/25-question test/i.test(examModeSource)) {
  throw new Error("Expected src/pages/ExamMode.jsx to remove hardcoded 25-question loading copy.");
}

if (/MCQ_EXAM_QUESTION_CAP|ESSAY_EXAM_QUESTION_CAP/.test(examModeSource)) {
  throw new Error("Regression detected: ExamMode should not hardcode fixed loading caps.");
}

if (!/const loadingExamQuestionCap = \(\(\) => \{[\s\S]*topic\?\.essayTargetCount[\s\S]*topic\?\.mcqTargetCount/s.test(examModeSource)) {
  throw new Error("Expected ExamMode to derive loading counts from topic or preparation targets.");
}

if (/ESSAY_EXAM_INTERACTIVE_START_COUNT/.test(examModeSource) || /generateEssayQuestions\(\{/.test(examModeSource)) {
  throw new Error("Regression detected: ExamMode should not pre-generate essay questions from the format picker.");
}

if (!/const ESSAY_QUESTION_TARGET_MAX_COUNT = 15;/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to allow the essay generator to satisfy the full 15-question exam cap.");
}

console.log("exam-count-and-timer-regression.test.mjs passed");
