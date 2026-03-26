import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  forceQuestionLimitedTier,
  summarizeQuestionSetQuality,
} from "../convex/lib/premiumQuality.js";

const aiSource = await fs.readFile(path.join(process.cwd(), "convex", "ai.ts"), "utf8");

assert.equal(
  aiSource.includes("usedIndexFallback: expandedEvidence.usedIndexFallback"),
  true,
  "Expected grounded evidence fallback usage to be tracked in the evidence pack."
);
assert.equal(
  aiSource.includes("forceLimited: groundedPack.usedIndexFallback === true"),
  true,
  "Expected extracted-text-backed fallback generation to force a limited quality tier."
);

const limitedQuestion = forceQuestionLimitedTier({
  questionType: "multiple_choice",
  questionText: "Which evidence-backed change most likely reduces delay?",
  qualityTier: "premium",
  qualityScore: 0.88,
  qualityFlags: ["grounded"],
  outcomeKey: "reduce-delay",
});
const summary = summarizeQuestionSetQuality([limitedQuestion]);

assert.equal(summary.qualityTier, "limited", "Expected fallback-backed questions to downgrade the exam tier to limited.");
assert.equal(
  summary.qualityWarnings.includes("fallback_evidence"),
  true,
  "Expected fallback-backed question sets to expose a fallback_evidence warning."
);

console.log("premium-fallback-regression.test.mjs passed");
