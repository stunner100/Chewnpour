import assert from "node:assert/strict";

import { buildClaimDrivenAssessmentBlueprint } from "../convex/lib/assessmentBlueprint.js";
import { computeQuestionCoverageGaps, selectCoverageGapTargets } from "../convex/lib/assessmentPolicy.js";
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
    claimText: "Reported surplus depends on revenue exceeding expenses.",
    sourcePassageIds: ["p2"],
    sourceQuotes: ["Reported surplus depends on revenue exceeding expenses."],
    claimType: "relationship",
    cognitiveOperations: ["discrimination"],
    bloomLevel: "understand",
    difficultyEstimate: "medium",
    questionYieldEstimate: 2,
    status: "active",
  },
  {
    _id: "claim-3",
    claimText: "Exchange gain or loss affects reported totals.",
    sourcePassageIds: ["p3"],
    sourceQuotes: ["Exchange gain or loss affects reported totals."],
    claimType: "relationship",
    cognitiveOperations: ["recall", "evaluation"],
    bloomLevel: "analyze",
    difficultyEstimate: "medium",
    questionYieldEstimate: 2,
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

const blueprint = buildClaimDrivenAssessmentBlueprint({
  subClaims,
  yieldEstimate,
  distractorCount: 0,
});

assert.ok(blueprint, "Expected a claim-driven blueprint.");

const initialCoverage = computeQuestionCoverageGaps({
  blueprint,
  examFormat: "mcq",
  questions: [],
  targetCount: 4,
});

const initialMcqTargets = selectCoverageGapTargets({
  coverage: initialCoverage,
  requestedCount: 4,
}).filter((target) => target.targetType === "multiple_choice");

assert.ok(
  initialMcqTargets.some((target) => target.subClaimId === "claim-1" && target.targetOp === "recognition" && target.targetTier === 1),
  "Expected recognition plan item coverage for claim-1.",
);
assert.ok(
  initialMcqTargets.some((target) => target.subClaimId === "claim-1" && target.targetOp === "application" && target.targetTier === 2),
  "Expected application plan item coverage for claim-1 to remain distinct from recognition.",
);

const afterRecognitionCoverage = computeQuestionCoverageGaps({
  blueprint,
  examFormat: "mcq",
  questions: [
    {
      questionType: "multiple_choice",
      outcomeKey: "claim-1",
      bloomLevel: "Remember",
      subClaimId: "claim-1",
      cognitiveOperation: "recognition",
      tier: 1,
      qualityPassed: true,
      status: "active",
    },
  ],
  targetCount: 4,
});

const remainingTargets = selectCoverageGapTargets({
  coverage: afterRecognitionCoverage,
  requestedCount: 4,
});

assert.ok(
  !remainingTargets.some((target) => target.subClaimId === "claim-1" && target.targetOp === "recognition" && target.targetTier === 1),
  "Expected completed recognition plan item to drop out of the remaining gap set.",
);
assert.ok(
  remainingTargets.some((target) => target.subClaimId === "claim-1" && target.targetOp === "application" && target.targetTier === 2),
  "Expected application plan item for the same outcome to remain uncovered after recognition is satisfied.",
);
assert.ok(
  remainingTargets.every((target) => typeof target.planItemKey === "string" && target.planItemKey.length > 0),
  "Expected selected coverage targets to preserve plan item keys.",
);

console.log("objective-plan-coverage-regression.test.mjs passed");
