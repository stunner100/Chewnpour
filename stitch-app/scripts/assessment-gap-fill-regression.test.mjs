import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const read = async (relativePath) =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const aiSource = await read("convex/ai.ts");
const groundedSource = await read("convex/grounded.ts");

assert.ok(
  aiSource.includes("export const retryAssessmentGapFillInternal = internalAction({"),
  "Expected ai.ts to expose retryAssessmentGapFillInternal."
);
assert.ok(
  aiSource.includes("const buildAssessmentGapFillPlan = ("),
  "Expected ai.ts to derive targeted gap-fill plans from topic readiness."
);
assert.ok(
  aiSource.includes("objectiveReasons.push(\"true_false_gap\")"),
  "Expected gap-fill planning to detect true/false deficits."
);
assert.ok(
  aiSource.includes("objectiveReasons.push(\"fill_blank_gap\")"),
  "Expected gap-fill planning to detect fill-blank deficits."
);
assert.ok(
  aiSource.includes("objectiveReasons.push(\"claim_coverage_gap\")"),
  "Expected gap-fill planning to detect uncovered claims."
);

const mcqRetryBlock = aiSource.match(/const runMcqGenerationWithLock = async \([\s\S]*?return \{\s*\.\.\.result,[\s\S]*?\n\};/);
assert.ok(mcqRetryBlock, "Expected to locate runMcqGenerationWithLock.");
assert.ok(
  mcqRetryBlock[0].includes("internal.ai.retryAssessmentGapFillInternal"),
  "Expected MCQ retries to schedule retryAssessmentGapFillInternal."
);
assert.ok(
  !mcqRetryBlock[0].includes("ctx.scheduler.runAfter(\n            MCQ_QUESTION_BACKGROUND_RETRY_DELAY_MS,\n            internal.ai.generateQuestionsForTopicInternal"),
  "Expected MCQ retries to stop scheduling generateQuestionsForTopicInternal directly."
);

const essayRetryBlock = aiSource.match(/const runEssayGenerationWithLock = async \([\s\S]*?return \{\s*\.\.\.result,[\s\S]*?\n\};/);
assert.ok(essayRetryBlock, "Expected to locate runEssayGenerationWithLock.");
assert.ok(
  essayRetryBlock[0].includes("internal.ai.retryAssessmentGapFillInternal"),
  "Expected essay retries to schedule retryAssessmentGapFillInternal."
);
assert.ok(
  !essayRetryBlock[0].includes("ctx.scheduler.runAfter(\n            ESSAY_QUESTION_BACKGROUND_RETRY_DELAY_MS,\n            internal.ai.generateEssayQuestionsForTopicInternal"),
  "Expected essay retries to stop scheduling generateEssayQuestionsForTopicInternal directly."
);

const regenerateBlock = aiSource.match(/export const regenerateQuestionsForTopic = action\({[\s\S]*?\n}\);/);
assert.ok(regenerateBlock, "Expected to locate regenerateQuestionsForTopic.");
assert.ok(
  regenerateBlock[0].includes("internal.ai.retryAssessmentGapFillInternal"),
  "Expected regenerateQuestionsForTopic to route follow-up work through retryAssessmentGapFillInternal."
);
assert.ok(
  !regenerateBlock[0].includes("internal.ai.generateQuestionsForTopicInternal"),
  "Expected regenerateQuestionsForTopic to stop directly scheduling the raw MCQ generator."
);
assert.ok(
  groundedSource.includes("ai.retryAssessmentGapFillInternal"),
  "Expected grounded scheduling helpers to use retryAssessmentGapFillInternal."
);

console.log("assessment-gap-fill-regression.test.mjs passed");
