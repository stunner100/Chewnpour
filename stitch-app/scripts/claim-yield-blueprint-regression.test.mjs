import assert from "node:assert/strict";

import {
  ASSESSMENT_BLUEPRINT_VERSION,
  buildClaimDrivenAssessmentBlueprint,
  normalizeAssessmentBlueprint,
} from "../convex/lib/assessmentBlueprint.js";
import { computeDynamicYieldTargets } from "../convex/lib/yieldEstimation.js";

const subClaims = [
  {
    _id: "claim-1",
    claimText: "International filing fees were 365.9 million Swiss francs in 2020.",
    sourcePassageIds: ["p1"],
    sourceQuotes: ["International filing fees were 365.9 million Swiss francs in 2020."],
    claimType: "quantitative",
    cognitiveOperations: ["recognition", "recall", "discrimination", "application"],
    bloomLevel: "remember",
    difficultyEstimate: "easy",
    questionYieldEstimate: 3,
    status: "active",
  },
  {
    _id: "claim-2",
    claimText: "The reported surplus was driven by fee revenue exceeding expenses.",
    sourcePassageIds: ["p2"],
    sourceQuotes: ["The reported surplus was driven by fee revenue exceeding expenses."],
    claimType: "relationship",
    cognitiveOperations: ["recognition", "application", "inference", "evaluation"],
    bloomLevel: "understand",
    difficultyEstimate: "medium",
    questionYieldEstimate: 4,
    status: "active",
  },
  {
    _id: "claim-3",
    claimText: "Exchange gain or loss on fees received affects reported revenue totals.",
    sourcePassageIds: ["p3"],
    sourceQuotes: ["Exchange gain or loss on fees received affects reported revenue totals."],
    claimType: "relationship",
    cognitiveOperations: ["recognition", "comparison", "inference", "synthesis"],
    bloomLevel: "analyze",
    difficultyEstimate: "hard",
    questionYieldEstimate: 4,
    status: "active",
  },
];

const yieldEstimate = computeDynamicYieldTargets(subClaims, [], {
  minObjectiveTarget: 4,
  maxObjectiveTarget: 18,
  minEssayTarget: 1,
  maxEssayTarget: 4,
  expectedPassRate: 0.65,
});

assert.ok(yieldEstimate.totalObjectiveTarget >= 4, "Expected dynamic yield to produce at least the floor objective target.");
assert.ok(yieldEstimate.mcqTarget >= 1, "Expected at least one multiple-choice target.");
assert.ok(yieldEstimate.essayTarget >= 1, "Expected at least one essay target for synthesis-capable claims.");
assert.equal(typeof yieldEstimate.reasoning, "string");

const blueprint = buildClaimDrivenAssessmentBlueprint({
  subClaims,
  yieldEstimate,
  distractorCount: 0,
});

assert.ok(blueprint, "Expected claim-driven blueprint to be built.");
assert.equal(blueprint.version, ASSESSMENT_BLUEPRINT_VERSION);
assert.equal(blueprint.subClaimCount, 3);
assert.equal(blueprint.yieldEstimate.totalObjectiveTarget, yieldEstimate.totalObjectiveTarget);
assert.ok(Array.isArray(blueprint.objectivePlan.items) && blueprint.objectivePlan.items.length > 0, "Expected planned objective items.");
assert.ok(Array.isArray(blueprint.essayPlan.items), "Expected essay plan items array.");
assert.ok(Array.isArray(blueprint.multipleChoicePlan.targetOutcomeKeys) && blueprint.multipleChoicePlan.targetOutcomeKeys.length > 0);
assert.ok(Array.isArray(blueprint.trueFalsePlan.targetOutcomeKeys) && blueprint.trueFalsePlan.targetOutcomeKeys.length > 0);
assert.ok(Array.isArray(blueprint.fillBlankPlan.targetOutcomeKeys) && blueprint.fillBlankPlan.targetOutcomeKeys.length > 0);

const normalized = normalizeAssessmentBlueprint(blueprint);
assert.ok(normalized, "Expected claim-driven blueprint to survive normalization.");
assert.equal(normalized.version, ASSESSMENT_BLUEPRINT_VERSION);
assert.equal(normalized.yieldEstimate.totalObjectiveTarget, yieldEstimate.totalObjectiveTarget);
assert.ok(Array.isArray(normalized.objectivePlan.items) && normalized.objectivePlan.items.length > 0);

console.log("claim-yield-blueprint-regression.test.mjs passed");
