import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  dedupeQuestionsByPrompt,
  selectQuestionsForAttempt,
} from "../convex/lib/examQuestionSelection.js";

const buildQuestion = (id, text, difficulty = "medium") => ({
  _id: id,
  questionText: text,
  difficulty,
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
    buildQuestion(`q${index + 1}`, `Question ${index + 1}?`, index % 2 === 0 ? "easy" : "hard")
  );
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [],
    subsetSize: 10,
    isEssay: false,
  });
  assert.equal(result.selectedQuestions.length, 10, "Expected first attempt to return subset-sized selection.");
  assert.equal(result.requiresFreshGeneration, false, "Expected first attempt not to require fresh generation.");
}

// 4) Retake with some unseen should prioritize unseen, then recycle seen to avoid blocking.
{
  const questions = Array.from({ length: 12 }, (_, index) =>
    buildQuestion(`q${index + 1}`, `Question ${index + 1}?`, "medium")
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
  });
  const selectedIds = new Set(result.selectedQuestions.map((q) => String(q._id)));
  for (const unseenId of ["q9", "q10", "q11", "q12"]) {
    assert.equal(
      selectedIds.has(unseenId),
      true,
      "Expected retake selection to include every unseen question first."
    );
  }
  assert.equal(result.selectedQuestions.length, 10, "Expected retake to be padded with recycled seen questions.");
  assert.equal(result.requiresFreshGeneration, false, "Expected fresh generation not required when unseen exists.");
}

// 5) If no unseen questions remain, still serve recycled questions and request fresh generation.
{
  const questions = [
    buildQuestion("q1", "Question 1?"),
    buildQuestion("q2", "Question 2?"),
  ];
  const completedAttempt = {
    questionIds: ["q1", "q2"],
    answers: [{ questionId: "q1", selectedAnswer: "A" }],
  };
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [completedAttempt],
    subsetSize: 10,
    isEssay: false,
  });
  assert.equal(
    result.selectedQuestions.length,
    2,
    "Expected recycled selection when unseen pool is exhausted."
  );
  assert.equal(
    result.requiresFreshGeneration,
    true,
    "Expected exhausted unseen pool to trigger fresh generation."
  );
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
