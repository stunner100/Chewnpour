import assert from "node:assert/strict";

import { buildClaimDrivenAssessmentBlueprint, resolveEssayPlanItemKey } from "../convex/lib/assessmentBlueprint.js";
import { computeQuestionCoverageGaps, selectCoverageGapTargets } from "../convex/lib/assessmentPolicy.js";
import { computeDynamicYieldTargets } from "../convex/lib/yieldEstimation.js";

const subClaims = Array.from({ length: 7 }, (_, index) => ({
  _id: `claim-${index + 1}`,
  claimText: `Claim ${index + 1} explains a different grounded part of the topic.`,
  sourcePassageIds: [`p${index + 1}`],
  sourceQuotes: [`Quote ${index + 1}`],
  claimType: "relationship",
  cognitiveOperations: index === 0
    ? ["recognition", "recall", "discrimination"]
    : ["recognition", "evaluation", "synthesis"],
  bloomLevel: index === 0
    ? "apply"
    : index % 2 === 0 ? "evaluate" : "analyze",
  difficultyEstimate: index % 2 === 0 ? "medium" : "hard",
  questionYieldEstimate: 2,
  status: "active",
}));

const yieldEstimate = computeDynamicYieldTargets(subClaims, [], {
  minObjectiveTarget: 4,
  maxObjectiveTarget: 18,
  minEssayTarget: 2,
  maxEssayTarget: 4,
  expectedPassRate: 0.65,
});

const blueprint = buildClaimDrivenAssessmentBlueprint({
  subClaims,
  yieldEstimate,
  distractorCount: 0,
});

assert.ok(blueprint, "Expected a claim-driven blueprint.");
assert.equal(blueprint.essayPlan.items.length, 2, "Expected two grouped essay plan items.");

const initialCoverage = computeQuestionCoverageGaps({
  blueprint,
  examFormat: "essay",
  questions: [],
  targetCount: 2,
});

const initialTargets = selectCoverageGapTargets({
  coverage: initialCoverage,
  requestedCount: 2,
});

assert.equal(initialTargets.length, 2, "Expected both essay plan items to be selected initially.");
assert.ok(
  initialTargets.every((target) => typeof target.planItemKey === "string" && target.planItemKey.length > 0),
  "Expected essay coverage targets to expose plan item keys.",
);

const firstEssayPlanItem = blueprint.essayPlan.items[0];
const firstEssayPlanItemKey = resolveEssayPlanItemKey(firstEssayPlanItem);
const firstEssayCoverage = computeQuestionCoverageGaps({
  blueprint,
  examFormat: "essay",
  questions: [
    {
      questionType: "essay",
      outcomeKey: firstEssayPlanItem.sourceOutcomeKeys[0],
      bloomLevel: firstEssayPlanItem.targetBloomLevel,
      sourceSubClaimIds: firstEssayPlanItem.sourceSubClaimIds,
      essayPlanItemKey: firstEssayPlanItemKey,
      qualityPassed: true,
      status: "active",
    },
  ],
  targetCount: 2,
});

const remainingTargets = selectCoverageGapTargets({
  coverage: firstEssayCoverage,
  requestedCount: 2,
});

assert.ok(
  !remainingTargets.some((target) => target.planItemKey === firstEssayPlanItemKey),
  "Expected satisfied essay plan item to drop out of remaining coverage targets.",
);
assert.ok(
  remainingTargets.some((target) => target.planItemKey !== firstEssayPlanItemKey),
  "Expected the second essay plan item to remain uncovered.",
);

console.log("essay-plan-coverage-regression.test.mjs passed");
