import assert from "node:assert/strict";

import {
  ASSESSMENT_BLUEPRINT_VERSION,
  DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION,
  normalizeAssessmentBlueprint,
} from "../convex/lib/assessmentBlueprint.js";

const blueprint = normalizeAssessmentBlueprint({
  outcomes: [
    {
      key: "interpret-data",
      objective: "Interpret the observed trend in the experiment",
      bloomLevel: "Analyze",
      evidenceFocus: "Observed trend lines and control comparisons",
      cognitiveTask: "interpret",
      difficultyBand: "hard",
      scenarioFrame: "A lab report discussion section",
    },
    {
      key: "justify-choice",
      objective: "Justify the best intervention from the evidence",
      bloomLevel: "Evaluate",
      evidenceFocus: "Tradeoffs and evidence strength",
      cognitiveTask: "justify",
      difficultyBand: "hard",
      scenarioFrame: "A policy memo for a department chair",
    },
    {
      key: "apply-method",
      objective: "Apply the method to a new case",
      bloomLevel: "Apply",
      evidenceFocus: "Worked examples and decision criteria",
      cognitiveTask: "apply",
      difficultyBand: "medium",
      scenarioFrame: "A clinical workflow handoff",
    },
  ],
  objectivePlan: {
    targetQuestionTypes: ["multiple_choice", "true_false", "fill_blank"],
    targetOutcomeKeys: ["interpret-data", "apply-method"],
    targetDifficultyDistribution: {
      easy: 1,
      medium: 2,
      hard: 1,
    },
    minDistinctOutcomeCount: 3,
  },
  multipleChoicePlan: {
    targetOutcomeKeys: ["interpret-data", "apply-method"],
  },
  trueFalsePlan: {
    targetOutcomeKeys: ["apply-method"],
  },
  fillBlankPlan: {
    targetOutcomeKeys: ["apply-method"],
    tokenBankRequired: true,
    exactAnswerOnly: true,
  },
  essayPlan: {
    targetOutcomeKeys: ["justify-choice", "interpret-data"],
    authenticScenarioRequired: true,
    authenticContextHint: "Use a realistic university committee setting",
    minDistinctOutcomeCount: 2,
    minDistinctScenarioFrameCount: 2,
  },
});

assert.ok(blueprint, "Expected premium blueprint to normalize.");
assert.equal(blueprint.version, ASSESSMENT_BLUEPRINT_VERSION, "Expected assessment blueprint v3.");
assert.deepEqual(
  blueprint.objectivePlan.targetDifficultyDistribution,
  DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION,
  "Expected target difficulty distribution to hard-cut to the tougher default."
);
assert.equal(blueprint.objectivePlan.minDistinctOutcomeCount, 2, "Expected objective distinct outcome floor to clamp to available outcomes.");
assert.equal(blueprint.essayPlan.minDistinctOutcomeCount, 2, "Expected essay distinct outcome floor to persist.");
assert.equal(blueprint.essayPlan.minDistinctScenarioFrameCount, 2, "Expected essay scenario diversity floor to persist.");
assert.deepEqual(
  blueprint.outcomes.map((outcome) => outcome.cognitiveTask),
  ["interpret", "justify", "apply"],
  "Expected premium blueprint outcomes to preserve cognitive tasks."
);
assert.deepEqual(
  blueprint.outcomes.map((outcome) => outcome.difficultyBand),
  ["hard", "hard", "medium"],
  "Expected premium blueprint outcomes to preserve difficulty bands."
);
assert.equal(
  blueprint.outcomes.filter((outcome) => outcome.scenarioFrame).length >= 2,
  true,
  "Expected premium blueprint outcomes to preserve scenario frames when present."
);

console.log("premium-blueprint-regression.test.mjs passed");
