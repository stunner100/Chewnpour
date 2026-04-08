import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  buildClaimDrivenAssessmentBlueprint,
  getAssessmentQuestionMetadataIssues,
} from "../convex/lib/assessmentBlueprint.js";
import { computeDynamicYieldTargets } from "../convex/lib/yieldEstimation.js";

const subClaims = [
  {
    _id: "claim-1",
    claimText: "International filing fees were 365.9 million Swiss francs in 2020.",
    sourcePassageIds: ["p1"],
    sourceQuotes: ["International filing fees were 365.9 million Swiss francs in 2020."],
    claimType: "quantitative",
    cognitiveOperations: ["recognition", "application"],
    bloomLevel: "remember",
    difficultyEstimate: "easy",
    questionYieldEstimate: 3,
    status: "active",
  },
  {
    _id: "claim-2",
    claimText: "Exchange gain or loss affects reported totals.",
    sourcePassageIds: ["p2"],
    sourceQuotes: ["Exchange gain or loss affects reported totals."],
    claimType: "relationship",
    cognitiveOperations: ["evaluation"],
    bloomLevel: "analyze",
    difficultyEstimate: "medium",
    questionYieldEstimate: 2,
    status: "active",
  },
];

const yieldEstimate = computeDynamicYieldTargets(subClaims, [], {
  minObjectiveTarget: 2,
  maxObjectiveTarget: 8,
  minEssayTarget: 1,
  maxEssayTarget: 2,
  expectedPassRate: 0.65,
});

const blueprint = buildClaimDrivenAssessmentBlueprint({
  subClaims,
  yieldEstimate,
  distractorCount: 0,
});

assert.ok(blueprint, "Expected claim-driven blueprint.");

const validQuestion = {
  questionType: "multiple_choice",
  generationVersion: blueprint.version,
  questionText: "Which option correctly states the international filing fees reported for 2020?",
  outcomeKey: "claim-1",
  bloomLevel: "Remember",
  subClaimId: "claim-1",
  cognitiveOperation: "recognition",
  tier: 1,
};

const invalidQuestion = {
  questionType: "multiple_choice",
  generationVersion: blueprint.version,
  questionText: "Which option correctly states the international filing fees reported for 2020?",
  outcomeKey: "claim-1",
  bloomLevel: "Remember",
};

assert.deepEqual(
  getAssessmentQuestionMetadataIssues({
    question: validQuestion,
    blueprint,
    questionType: "multiple_choice",
  }),
  [],
  "Expected valid objective plan metadata to pass validation.",
);

const invalidIssues = getAssessmentQuestionMetadataIssues({
  question: invalidQuestion,
  blueprint,
  questionType: "multiple_choice",
});

assert.ok(invalidIssues.includes("missing subClaimId"), "Expected subClaimId to be required for objective questions.");
assert.ok(invalidIssues.includes("missing cognitiveOperation"), "Expected cognitiveOperation to be required for objective questions.");
assert.ok(invalidIssues.includes("missing tier"), "Expected tier to be required for objective questions.");

const aiSource = await fs.readFile(path.join(process.cwd(), "convex/ai.ts"), "utf8");
for (const requiredSnippet of [
  "tier: normalizeGeneratedTier(",
  "subClaimId: String(questionRecord?.subClaimId",
  "cognitiveOperation: normalizeGeneratedCognitiveOperation(",
  "groundingEvidence: buildGroundingEvidenceSummary(",
]) {
  assert.ok(aiSource.includes(requiredSnippet), `Expected ai.ts to persist ${requiredSnippet}`);
}

console.log("objective-plan-metadata-regression.test.mjs passed");
