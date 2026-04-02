import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const preparationsPath = path.join(root, "convex", "examPreparations.ts");
const examModePath = path.join(root, "src", "pages", "ExamMode.jsx");

const [preparationsSource, examModeSource] = await Promise.all([
  fs.readFile(preparationsPath, "utf8"),
  fs.readFile(examModePath, "utf8"),
]);

for (const launchMode of [
  'continue_preparation',
  'resume_saved_attempt',
  'open_saved_exam_set',
  'retry_existing_preparation',
  'new_preparation',
]) {
  if (!preparationsSource.includes(`"${launchMode}"`)) {
    throw new Error(`Expected examPreparations.ts to classify launch mode "${launchMode}".`);
  }
}

if (!/export const getExamLaunchState = query\(/.test(preparationsSource)) {
  throw new Error("Expected examPreparations.ts to expose getExamLaunchState for the format picker.");
}

if (!/launchMode:\s*result\.launchMode/.test(preparationsSource) || !/questions,\s*\n\s*attemptStartedAt/.test(preparationsSource)) {
  throw new Error("Expected startExamPreparation to return launchMode plus a ready snapshot payload for saved exams.");
}

if (!/api\.examPreparations\.getExamLaunchState/.test(examModeSource)) {
  throw new Error("Expected ExamMode to query the launch-state summary before rendering the format picker.");
}

for (const label of [
  "Resume Objective Quiz",
  "Open Saved Objective Quiz",
  "Resume Essay / Theory",
  "Open Saved Essay / Theory",
]) {
  if (!examModeSource.includes(label)) {
    throw new Error(`Expected ExamMode to surface the saved-exam launch label "${label}".`);
  }
}

if (!/const applyReadyPreparationState = useCallback/.test(examModeSource)) {
  throw new Error("Expected ExamMode to centralize ready-attempt hydration.");
}

if (!/applyReadyPreparationState\(\{\s*\n\s*preparationId:\s*result\?\.preparationId/s.test(examModeSource)) {
  throw new Error("Expected ExamMode to hydrate a ready saved exam directly from startExamPreparation.");
}

console.log("exam-launch-state-regression.test.mjs passed");
