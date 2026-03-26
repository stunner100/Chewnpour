import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const questionBankConfigPath = path.join(root, "convex", "lib", "questionBankConfig.js");
const examsPath = path.join(root, "convex", "exams.ts");
const preparationsPath = path.join(root, "convex", "examPreparations.ts");

const [questionBankConfigSource, examsSource, preparationsSource] = await Promise.all([
  fs.readFile(questionBankConfigPath, "utf8"),
  fs.readFile(examsPath, "utf8"),
  fs.readFile(preparationsPath, "utf8"),
]);

for (const exportPattern of [
  /export const resolveMcqAttemptTarget =/,
  /export const resolveEssayAttemptTarget =/,
  /export const resolveMcqBankTarget =/,
  /export const resolveEssayBankTarget =/,
  /export const resolveAssessmentCapacity =/,
]) {
  if (!exportPattern.test(questionBankConfigSource)) {
    throw new Error("Expected questionBankConfig.js to export the shared dynamic exam sizing helpers.");
  }
}

if (!/attemptTargetCount:\s*capacity\.attemptTargetCount/.test(preparationsSource)) {
  throw new Error("Expected exam preparation records to seed attemptTargetCount from dynamic capacity.");
}

if (!/bankTargetCount:\s*capacity\.bankTargetCount/.test(preparationsSource)) {
  throw new Error("Expected exam preparation records to seed bankTargetCount from dynamic capacity.");
}

if (!/const capacity = resolveTopicQuestionCounts\(/.test(examsSource)) {
  throw new Error("Expected exams.ts to resolve topic-driven capacity before creating attempts.");
}

if (!/attemptTargetCount:\s*capacity\.attemptTargetCount/.test(examsSource)) {
  throw new Error("Expected exams.ts responses to expose the resolved attemptTargetCount.");
}

if (!/bankTargetCount:\s*capacity\.bankTargetCount/.test(examsSource)) {
  throw new Error("Expected exams.ts responses to expose the resolved bankTargetCount.");
}

console.log("exam-dynamic-target-regression.test.mjs passed");
