import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiPath = path.join(root, "convex", "ai.ts");
const topicsPath = path.join(root, "convex", "topics.ts");
const schemaPath = path.join(root, "convex", "schema.ts");

const [aiSource, topicsSource, schemaSource] = await Promise.all([
  fs.readFile(aiPath, "utf8"),
  fs.readFile(topicsPath, "utf8"),
  fs.readFile(schemaPath, "utf8"),
]);

for (const requiredPattern of [
  "resolveEvidenceRichMcqCap",
  "rebaseQuestionBankTargetAfterRun",
  "const resolveMcqQuestionBankTarget =",
  "const targetResolution = resolveMcqQuestionBankTarget({",
  "mcqTargetCount: persistedTargetCount",
  "persistedTargetCount = rebaseQuestionBankTargetAfterRun({",
  "evidenceRichnessCap: targetResolution.evidenceRichnessCap",
  "wordCountTarget: targetResolution.wordCountTarget",
]) {
  if (!aiSource.includes(requiredPattern)) {
    throw new Error(`Expected ai.ts to include "${requiredPattern}" for evidence-rich MCQ target capping.`);
  }
}

for (const requiredPattern of [
  "const resolveTopicMcqTargetCount =",
  "mcqTargetCount: computedReadiness.mcqTargetCount,",
]) {
  if (!topicsSource.includes(requiredPattern)) {
    throw new Error(`Expected topics.ts to include "${requiredPattern}" for persisted MCQ target readiness.`);
  }
}

if (!schemaSource.includes("mcqTargetCount: v.optional(v.number())")) {
  throw new Error("Expected schema.ts to persist mcqTargetCount on topics.");
}

console.log("mcq-evidence-richness-cap-regression.test.mjs passed");
