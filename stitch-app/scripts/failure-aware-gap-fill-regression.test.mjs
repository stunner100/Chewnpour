import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const read = async (relativePath) =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const [
  aiSource,
  blueprintSource,
  topicsSource,
  schemaSource,
  groundedGenerationSource,
] = await Promise.all([
  read("convex/ai.ts"),
  read("convex/lib/assessmentBlueprint.js"),
  read("convex/topics.ts"),
  read("convex/schema.ts"),
  read("convex/lib/groundedGeneration.ts"),
]);

for (const snippet of [
  "const MAX_PLAN_ITEM_ATTEMPTS = 3;",
  "const MAX_GAP_FILL_ROUNDS = 2;",
  "const recordObjectivePlanItemFailure = (planItem: any, failure:",
  "const recordEssayPlanItemFailure = (planItem: any, failure:",
  "const routeObjectiveRetryStrategy = (planItem: any, subClaims: any[]): any => {",
  "const routeEssayRetryStrategy = (planItem: any, subClaims: any[]): any => {",
  "const buildAssessmentDiagnosticReport = (topicId: any, topicTitle: string, blueprint: any, roundNumber: number) => {",
  "reason: assessmentBlueprint ? \"all_failed_items_terminal\" : \"no_targeted_gap_fill_needed\"",
  "diagnosticReport,",
]) {
  assert.ok(aiSource.includes(snippet), `Expected ai.ts to include ${snippet}`);
}

assert.ok(
  aiSource.includes("item.status = \"terminal\""),
  "Expected retryAssessmentGapFillInternal to mark terminal plan items."
);
assert.ok(
  aiSource.includes("feedbackInjection"),
  "Expected failure-aware retries to inject feedback into later attempts."
);
assert.ok(
  aiSource.includes("compositeClaimIds"),
  "Expected failure-aware retries to support composite claim routing."
);

for (const snippet of [
  "attemptCount: Math.max(0, Math.round(Number(item.attemptCount || 0)))",
  "failHistory: normalizeFailureHistory(item.failHistory)",
  "terminalReason: normalizeText(item.terminalReason || \"\") || undefined",
  "feedbackInjection: normalizeText(item.feedbackInjection || \"\") || undefined",
]) {
  assert.ok(
    blueprintSource.includes(snippet),
    `Expected assessmentBlueprint.js to normalize ${snippet}`
  );
}

assert.ok(
  topicsSource.includes("export const updateAssessmentBlueprintProgressInternal = internalMutation({"),
  "Expected topics.ts to expose updateAssessmentBlueprintProgressInternal."
);
assert.ok(
  topicsSource.includes("diagnosticReport: args.diagnosticReport ?? topic.diagnosticReport"),
  "Expected blueprint progress updates to persist diagnostic reports."
);

assert.ok(
  schemaSource.includes("diagnosticReport: v.optional(v.any())"),
  "Expected topic schema to store failure-aware diagnostic reports."
);

for (const snippet of [
  "If a coverage gap includes retryStrategy or feedbackInjection",
  "If a coverage gap includes multiple sourceSubClaimIds",
]) {
  assert.ok(
    groundedGenerationSource.includes(snippet),
    `Expected groundedGeneration.ts to include retry-aware prompt guidance: ${snippet}`
  );
}

console.log("failure-aware-gap-fill-regression.test.mjs passed");
