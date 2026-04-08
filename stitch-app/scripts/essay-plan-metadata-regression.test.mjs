import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  buildClaimDrivenAssessmentBlueprint,
  getAssessmentQuestionMetadataIssues,
  resolveEssayPlanItemKey,
} from "../convex/lib/assessmentBlueprint.js";
import { computeDynamicYieldTargets } from "../convex/lib/yieldEstimation.js";

const subClaims = Array.from({ length: 3 }, (_, index) => ({
  _id: `claim-${index + 1}`,
  claimText: `Claim ${index + 1} explains a grounded evaluative point.`,
  sourcePassageIds: [`p${index + 1}`],
  sourceQuotes: [`Quote ${index + 1}`],
  claimType: "relationship",
  cognitiveOperations: index === 0
    ? ["recognition", "recall", "discrimination"]
    : ["evaluation", "synthesis"],
  bloomLevel: index === 0 ? "apply" : index === 1 ? "analyze" : "evaluate",
  difficultyEstimate: "medium",
  questionYieldEstimate: 2,
  status: "active",
}));

const yieldEstimate = computeDynamicYieldTargets(subClaims, [], {
  minObjectiveTarget: 3,
  maxObjectiveTarget: 10,
  minEssayTarget: 1,
  maxEssayTarget: 3,
  expectedPassRate: 0.65,
});

const blueprint = buildClaimDrivenAssessmentBlueprint({
  subClaims,
  yieldEstimate,
  distractorCount: 0,
});

assert.ok(blueprint, "Expected claim-driven blueprint.");
assert.equal(blueprint.essayPlan.items.length, 1, "Expected one essay plan item.");

const essayPlanItem = blueprint.essayPlan.items[0];
const essayPlanItemKey = resolveEssayPlanItemKey(essayPlanItem);
const matchingOutcomeKey = essayPlanItem.sourceOutcomeKeys.at(-1) || essayPlanItem.sourceOutcomeKeys[0];
const matchingOutcome = blueprint.outcomes.find((outcome) => outcome.key === matchingOutcomeKey);
const alignedQuestionText = `Evaluate how ${matchingOutcome?.objective || "the grounded evaluative point"} connects with the other grouped claims in the topic.`;

const validEssay = {
  questionType: "essay",
  generationVersion: blueprint.version,
  questionText: alignedQuestionText,
  outcomeKey: matchingOutcomeKey,
  bloomLevel: essayPlanItem.targetBloomLevel,
  authenticContext: "A realistic institutional review memo.",
  sourceSubClaimIds: essayPlanItem.sourceSubClaimIds,
  essayPlanItemKey,
  rubricPoints: ["Uses all grouped claims", "Justifies evaluation with evidence"],
};

const invalidEssay = {
  questionType: "essay",
  generationVersion: blueprint.version,
  questionText: alignedQuestionText,
  outcomeKey: matchingOutcomeKey,
  bloomLevel: essayPlanItem.targetBloomLevel,
  authenticContext: "A realistic institutional review memo.",
};

assert.deepEqual(
  getAssessmentQuestionMetadataIssues({
    question: validEssay,
    blueprint,
    questionType: "essay",
  }),
  [],
  "Expected valid essay plan metadata to pass validation.",
);

const invalidIssues = getAssessmentQuestionMetadataIssues({
  question: invalidEssay,
  blueprint,
  questionType: "essay",
});

assert.ok(invalidIssues.includes("missing essayPlanItemKey"), "Expected essayPlanItemKey to be required.");
assert.ok(invalidIssues.includes("missing sourceSubClaimIds"), "Expected sourceSubClaimIds to be required.");

const aiSource = await fs.readFile(path.join(process.cwd(), "convex/ai.ts"), "utf8");
const topicsSource = await fs.readFile(path.join(process.cwd(), "convex/topics.ts"), "utf8");

for (const requiredSnippet of [
  "essayPlanItemKey: String(",
  "sourceSubClaimIds: Array.isArray(resolvedEssayPlanItem?.sourceSubClaimIds)",
]) {
  assert.ok(aiSource.includes(requiredSnippet), `Expected ai.ts to include ${requiredSnippet}`);
}

for (const requiredSnippet of [
  "essayPlanItemKey: v.optional(v.string())",
  "sourceSubClaimIds: v.optional(v.array(v.id(\"topicSubClaims\")))",
]) {
  assert.ok(topicsSource.includes(requiredSnippet), `Expected topics.ts to include ${requiredSnippet}`);
}

console.log("essay-plan-metadata-regression.test.mjs passed");
