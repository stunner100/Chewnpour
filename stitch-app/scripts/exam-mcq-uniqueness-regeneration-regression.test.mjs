import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  dedupeQuestionsByPrompt,
  selectQuestionsForAttempt,
} from "../convex/lib/examQuestionSelection.js";

const blueprint = {
  version: "assessment-blueprint-v2",
  outcomes: [
    { key: "mcq-remember", objective: "Recall facts", bloomLevel: "Remember", evidenceFocus: "facts" },
    { key: "mcq-apply", objective: "Apply concepts", bloomLevel: "Apply", evidenceFocus: "application" },
    { key: "essay-analyze", objective: "Analyze", bloomLevel: "Analyze", evidenceFocus: "analysis" },
    { key: "essay-create", objective: "Create", bloomLevel: "Create", evidenceFocus: "creation" },
  ],
  objectivePlan: {
    allowedQuestionTypes: ["multiple_choice", "true_false", "fill_blank"],
    targetQuestionTypes: ["multiple_choice", "true_false", "fill_blank"],
    targetMix: { multiple_choice: 5, true_false: 3, fill_blank: 2 },
    targetOutcomeKeys: ["mcq-remember", "mcq-apply"],
    targetBloomLevels: ["Remember", "Apply"],
  },
  multipleChoicePlan: {
    allowedBloomLevels: ["Remember", "Understand", "Apply", "Analyze"],
    targetBloomLevels: ["Remember", "Apply"],
    targetOutcomeKeys: ["mcq-remember", "mcq-apply"],
  },
  trueFalsePlan: {
    allowedBloomLevels: ["Remember", "Understand", "Apply"],
    targetBloomLevels: ["Remember", "Apply"],
    targetOutcomeKeys: ["mcq-remember", "mcq-apply"],
  },
  fillBlankPlan: {
    allowedBloomLevels: ["Remember", "Understand", "Apply"],
    targetBloomLevels: ["Remember", "Apply"],
    targetOutcomeKeys: ["mcq-remember", "mcq-apply"],
    tokenBankRequired: true,
    exactAnswerOnly: true,
  },
  essayPlan: {
    allowedBloomLevels: ["Analyze", "Evaluate", "Create"],
    targetBloomLevels: ["Analyze", "Create"],
    targetOutcomeKeys: ["essay-analyze", "essay-create"],
    authenticScenarioRequired: false,
  },
};

const buildQuestion = (
  id,
  text,
  difficulty = "medium",
  outcomeKey = "mcq-remember",
  bloomLevel = "Remember"
) => ({
  _id: id,
  questionText: text,
  difficulty,
  outcomeKey,
  bloomLevel,
});

// 1) Duplicate prompts should be collapsed to one question per normalized stem.
{
  const questions = [
    buildQuestion("q1", "What is Photosynthesis?"),
    buildQuestion("q2", "what is photosynthesis "),
    buildQuestion("q3", "Explain cellular respiration."),
  ];
  const deduped = dedupeQuestionsByPrompt(questions);
  assert.equal(deduped.length, 2, "Expected duplicate prompt variants to be removed.");
}

// 2) Near-duplicate paraphrases should also be collapsed.
{
  const questions = [
    buildQuestion("q1", "Which factor most directly increases enzyme activity in this reaction?"),
    buildQuestion("q2", "In this reaction, which factor directly increases enzyme activity the most?"),
    buildQuestion("q3", "What is substrate specificity in enzyme action?"),
  ];
  const deduped = dedupeQuestionsByPrompt(questions);
  assert.equal(deduped.length, 2, "Expected near-duplicate paraphrases to be removed.");
}

// 3) First attempt (no completed history) can select up to subset size.
{
  const questions = Array.from({ length: 12 }, (_, index) =>
    buildQuestion(
      `q${index + 1}`,
      `Question ${index + 1}?`,
      index % 2 === 0 ? "easy" : "hard",
      index % 2 === 0 ? "mcq-remember" : "mcq-apply",
      index % 2 === 0 ? "Remember" : "Apply"
    )
  );
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [],
    subsetSize: 10,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: blueprint,
    bankTargetCount: 12,
  });
  assert.equal(result.selectedQuestions.length, 10, "Expected first attempt to return subset-sized selection.");
  assert.equal(result.requiresGeneration, false, "Expected first attempt not to require fresh generation.");
  assert.equal(result.coverageSatisfied, true, "Expected first attempt to satisfy coverage targets.");
}

// 4) Retake with some unseen should block for generation while the bank can still grow.
{
  const questions = Array.from({ length: 12 }, (_, index) =>
    buildQuestion(
      `q${index + 1}`,
      `Question ${index + 1}?`,
      "medium",
      index % 2 === 0 ? "mcq-remember" : "mcq-apply",
      index % 2 === 0 ? "Remember" : "Apply"
    )
  );
  const completedAttempt = {
    questionIds: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"],
    answers: [{ questionId: "q1", selectedAnswer: "A" }],
  };
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [completedAttempt],
    subsetSize: 10,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: blueprint,
    bankTargetCount: 18,
  });
  const selectedIds = new Set(result.selectedQuestions.map((q) => String(q._id)));
  for (const unseenId of ["q9", "q10", "q11", "q12"]) {
    assert.equal(
      selectedIds.has(unseenId),
      true,
      "Expected retake selection to include every unseen question first."
    );
  }
  assert.equal(result.selectedQuestions.length, 4, "Expected expandable retake to keep only unseen questions before regeneration.");
  assert.equal(result.recycledCount, 0, "Expected expandable retake not to recycle questions.");
  assert.equal(result.requiresGeneration, true, "Expected expandable retake to request fresh generation.");
}

// 5) If no unseen questions remain and the bank is exhausted, serve recycled questions instead of looping generation.
{
  const questions = [
    buildQuestion("q1", "Question 1?", "medium", "mcq-remember", "Remember"),
    buildQuestion("q2", "Question 2?", "medium", "mcq-apply", "Apply"),
  ];
  const completedAttempt = {
    questionIds: ["q1", "q2"],
    answers: [{ questionId: "q1", selectedAnswer: "A" }],
  };
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [completedAttempt],
    subsetSize: 2,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: blueprint,
    bankTargetCount: 2,
  });
  assert.equal(
    result.selectedQuestions.length,
    2,
    "Expected recycled selection when unseen pool is exhausted."
  );
  assert.equal(
    result.requiresGeneration,
    false,
    "Expected exhausted unseen pool to stop requesting more generation."
  );
  assert.equal(result.freshnessSatisfied, false, "Expected exhausted unseen pool to report recycled questions.");
  assert.equal(result.recycledCount, 2, "Expected exhausted unseen pool to recycle both questions.");
}

// 6) Grounded acceptance gate should be active in MCQ generation path.
{
  const aiSource = await fs.readFile(path.join(process.cwd(), "convex", "ai.ts"), "utf8");
  assert.equal(
    /applyGroundedAcceptance\(\{[\s\S]*type:\s*"mcq"/.test(aiSource),
    true,
    "Expected MCQ generation to use grounded acceptance."
  );
}

console.log("exam-mcq-uniqueness-regeneration-regression.test.mjs passed");
