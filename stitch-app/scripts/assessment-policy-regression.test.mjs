import assert from "node:assert/strict";
import {
  computeQuestionCoverageGaps,
  resolveAssessmentGenerationPolicy,
  selectCoverageGapTargets,
} from "../convex/lib/assessmentPolicy.js";

const blueprint = {
  version: "assessment-blueprint-v3",
  outcomes: [
    { key: "outcome-1", objective: "Recall the main process", bloomLevel: "Remember", evidenceFocus: "process steps", cognitiveTask: "identify", difficultyBand: "easy" },
    { key: "outcome-2", objective: "Apply the process to examples", bloomLevel: "Apply", evidenceFocus: "worked examples", cognitiveTask: "apply", difficultyBand: "medium", scenarioFrame: "A realistic lab case" },
    { key: "outcome-3", objective: "Evaluate tradeoffs", bloomLevel: "Evaluate", evidenceFocus: "tradeoffs", cognitiveTask: "justify", difficultyBand: "hard", scenarioFrame: "A decision memo" },
  ],
  mcqPlan: {
    allowedBloomLevels: ["Remember", "Understand", "Apply", "Analyze"],
    targetBloomLevels: ["Remember", "Apply"],
    targetOutcomeKeys: ["outcome-1", "outcome-2"],
  },
  essayPlan: {
    allowedBloomLevels: ["Analyze", "Evaluate", "Create"],
    targetBloomLevels: ["Evaluate"],
    targetOutcomeKeys: ["outcome-3"],
    authenticScenarioRequired: true,
    authenticContextHint: "Use a realistic project setting.",
  },
};

const emptyCoverage = computeQuestionCoverageGaps({
  blueprint,
  examFormat: "mcq",
  questions: [],
  targetCount: 5,
});

assert.equal(emptyCoverage.status, "needs_generation", "Empty MCQ coverage should require generation.");
assert.equal(emptyCoverage.totalGapCount, 5, "Five MCQ slots should remain uncovered.");
assert.deepEqual(
  emptyCoverage.coverageTargets.map((item) => item.desiredCount),
  [3, 2],
  "MCQ targets should distribute counts across target outcomes in round-robin order."
);

const partialCoverage = computeQuestionCoverageGaps({
  blueprint,
  examFormat: "mcq",
  questions: [
    { questionType: "multiple_choice", outcomeKey: "outcome-1", bloomLevel: "Remember" },
    { questionType: "multiple_choice", outcomeKey: "outcome-2", bloomLevel: "Apply" },
  ],
  targetCount: 5,
});

assert.equal(partialCoverage.totalGapCount, 3, "Existing MCQs should reduce the remaining coverage gaps.");
assert.deepEqual(
  selectCoverageGapTargets({ coverage: partialCoverage, requestedCount: 2 }).map((item) => [item.outcomeKey, item.requestedCount]),
  [["outcome-1", 1], ["outcome-2", 1]],
  "Gap target selection should balance requests across the remaining missing outcomes."
);

const readyEssayPolicy = resolveAssessmentGenerationPolicy({
  blueprint,
  examFormat: "essay",
  questions: [
    { questionType: "essay", outcomeKey: "outcome-3", bloomLevel: "Evaluate" },
  ],
  targetCount: 1,
});

assert.equal(readyEssayPolicy.ready, true, "Essay coverage should report ready once the targeted outcome is covered.");
assert.equal(readyEssayPolicy.freshnessTargetCount, 1, "Freshness target should stay bounded by the target count.");

console.log("assessment-policy-regression.test.mjs passed");
