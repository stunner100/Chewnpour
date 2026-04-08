import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const read = async (relativePath) =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const aiSource = await read("convex/ai.ts");

for (const snippet of [
  "const isProviderThrottleMessage = (value: any) => {",
  "const classifyPlanExecutionFailure = (reason: any, questionType?: string) => {",
  "if (normalizedReasons.some((reason) => isProviderThrottleMessage(reason))) return \"provider_throttled\";",
  "if (failReason === \"provider_throttled\") {",
  "provider throttled generation for this plan item",
  "provider throttled essay generation",
  "let providerThrottleDetectedInRound = false;",
  "if (!providerThrottleDetectedInRound && roundAdded === 0 && getUniqueQuestionCount() < targetCount) {",
  "[QuestionBank] provider_throttled_round_abort",
  "let providerThrottleDetected = false;",
  "if (!providerThrottleDetected && candidates.length < remainingNeeded && Date.now() < deadlineMs - 1200) {",
  "[EssayQuestionBank] provider_throttled_recovery_abort",
]) {
  assert.ok(
    aiSource.includes(snippet),
    `Expected ai.ts to include ${snippet}`
  );
}

assert.ok(
  aiSource.includes("if (failReason === \"provider_throttled\") {\n                        providerThrottleDetectedInRound = true;"),
  "Expected objective batch failures to mark provider throttling before recording plan item failures."
);

assert.ok(
  aiSource.includes("const failReason = classifyPlanExecutionFailure(settled.reason, \"essay\");"),
  "Expected essay batch failures to classify provider-throttle errors separately."
);

console.log("provider-throttle-routing-regression.test.mjs passed");
