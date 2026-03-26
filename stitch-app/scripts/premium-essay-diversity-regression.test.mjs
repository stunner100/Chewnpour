import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { summarizeQuestionSetQuality } from "../convex/lib/premiumQuality.js";

const generationSource = await fs.readFile(
  path.join(process.cwd(), "convex", "lib", "groundedGeneration.ts"),
  "utf8"
);

for (const requiredSnippet of [
  "Across the batch, diversify outcomes and scenario frames before repeating the same one.",
  "At least one prompt should require analysis/explanation and one should require evaluation/justification when the evidence supports both.",
  "Use sharper university-style task verbs and explicit response scope.",
  "rubricPoints must cover thesis/claim quality, evidence use, reasoning quality, and completeness where applicable.",
  "Model answers must demonstrate reasoning, not just repeat content.",
]) {
  assert.equal(
    generationSource.includes(requiredSnippet),
    true,
    `Expected premium essay generation contract to include: ${requiredSnippet}`
  );
}

const repetitiveEssaySet = summarizeQuestionSetQuality([
  {
    questionType: "essay",
    questionText: "Analyze the same experiment from the same committee memo.",
    qualityTier: "premium",
    qualityScore: 0.86,
    outcomeKey: "analyze-experiment",
    authenticContext: "The same committee memo",
  },
  {
    questionType: "essay",
    questionText: "Evaluate the same experiment from the same committee memo.",
    qualityTier: "premium",
    qualityScore: 0.87,
    outcomeKey: "analyze-experiment",
    authenticContext: "The same committee memo",
  },
  {
    questionType: "essay",
    questionText: "Justify the same experiment from the same committee memo.",
    qualityTier: "premium",
    qualityScore: 0.88,
    outcomeKey: "analyze-experiment",
    authenticContext: "The same committee memo",
  },
]);

assert.equal(repetitiveEssaySet.qualityTier, "limited", "Expected repetitive essay batches to miss the premium tier.");
assert.equal(
  repetitiveEssaySet.qualityWarnings.includes("low_diversity"),
  true,
  "Expected repetitive essay batches to flag low diversity."
);

console.log("premium-essay-diversity-regression.test.mjs passed");
