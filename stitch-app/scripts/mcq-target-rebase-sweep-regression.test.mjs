import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const groundedPath = path.join(root, "convex", "grounded.ts");
const source = await fs.readFile(groundedPath, "utf8");

for (const expectedPattern of [
  "export const rebaseStaleOversizedMcqTargets = internalAction({",
  "resolveMcqTargetForSweep",
  "refreshTopicExamReadinessInternal",
  "mcqTargetCount: topic.recalculatedTarget",
  "internal.ai.generateQuestionsForTopicInternal",
]) {
  if (!source.includes(expectedPattern)) {
    throw new Error(`Expected grounded.ts to include "${expectedPattern}" for stale MCQ target rebasing.`);
  }
}

console.log("mcq-target-rebase-sweep-regression.test.mjs passed");
