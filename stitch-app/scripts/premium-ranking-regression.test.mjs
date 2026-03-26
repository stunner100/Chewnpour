import assert from "node:assert/strict";

import {
  compareQuestionsByPremiumQuality,
  evaluateQuestionQuality,
  summarizeQuestionSetQuality,
} from "../convex/lib/premiumQuality.js";

const premiumCandidate = {
  questionType: "multiple_choice",
  questionText: "A department must reduce lab turnaround time without changing staffing. Which interpretation of the evidence best justifies the most effective intervention?",
  bloomLevel: "Analyze",
  cognitiveTask: "justify",
  difficulty: "hard",
  options: [
    { label: "A", text: "Increase batching because it lowers setup overhead while preserving sample integrity.", isCorrect: true },
    { label: "B", text: "Remove quality checks because the evidence never mentions error rates.", isCorrect: false },
    { label: "C", text: "Delay sample logging until the end of the day to reduce interruptions.", isCorrect: false },
    { label: "D", text: "Route all cases to the most senior analyst regardless of queue length.", isCorrect: false },
  ],
  citations: [{ passageId: "p1-0" }, { passageId: "p1-1" }],
  groundingScore: 0.9,
  outcomeKey: "optimize-workflow",
  authenticContext: "A university lab operations review",
};

const recallCandidate = {
  questionType: "multiple_choice",
  questionText: "What is the definition of batching?",
  bloomLevel: "Remember",
  cognitiveTask: "define",
  difficulty: "easy",
  options: [
    { label: "A", text: "Handling work together.", isCorrect: true },
    { label: "B", text: "A totally unrelated term.", isCorrect: false },
    { label: "C", text: "Another unrelated term.", isCorrect: false },
    { label: "D", text: "All of the above.", isCorrect: false },
  ],
  citations: [{ passageId: "p1-0" }],
  groundingScore: 0.9,
  outcomeKey: "optimize-workflow",
};

const evaluatedPremium = {
  ...premiumCandidate,
  ...evaluateQuestionQuality(premiumCandidate).qualitySignals,
  qualityTier: evaluateQuestionQuality(premiumCandidate).qualityTier,
};
const evaluatedRecall = {
  ...recallCandidate,
  ...evaluateQuestionQuality(recallCandidate).qualitySignals,
  qualityTier: evaluateQuestionQuality(recallCandidate).qualityTier,
};

assert.equal(
  compareQuestionsByPremiumQuality(evaluatedPremium, evaluatedRecall) < 0,
  true,
  "Expected higher-rigor, clearer questions to outrank low-level recall questions."
);

const premiumSetSummary = summarizeQuestionSetQuality([
  evaluatedPremium,
  {
    ...evaluatedPremium,
    outcomeKey: "evaluate-tradeoffs",
    authenticContext: "A procurement review meeting",
    diversityCluster: "multiple_choice::evaluate-tradeoffs::procurement review meeting",
  },
  {
    ...evaluatedPremium,
    questionType: "essay",
    outcomeKey: "defend-recommendation",
    authenticContext: "A dean's committee memo",
    diversityCluster: "essay::defend-recommendation::dean committee memo",
    distractorScore: undefined,
  },
]);
assert.equal(premiumSetSummary.qualityTier, "premium", "Expected diverse strong sets to clear the premium tier.");

console.log("premium-ranking-regression.test.mjs passed");
