import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { dedupeQuestionsByPrompt, selectQuestionsForAttempt } from "../convex/lib/examQuestionSelection.js";

const root = process.cwd();
const selectionPath = path.join(root, "convex", "lib", "examQuestionSelection.js");
const examsPath = path.join(root, "convex", "exams.ts");

const [selectionSource, examsSource] = await Promise.all([
  fs.readFile(selectionPath, "utf8"),
  fs.readFile(examsPath, "utf8"),
]);

assert.match(examsSource, /EXAM_ATTEMPT_REUSE_LOOKBACK = 50/, "Expected 50-attempt lookback.");
assert.match(
  examsSource,
  /selectQuestionsForAttempt\(\{[\s\S]*assessmentBlueprint:\s*topic\?\.assessmentBlueprint,[\s\S]*bankTargetCount:\s*capacity\.bankTargetCount,/,
  "Expected prepared attempt selection to pass blueprint and bank target metadata."
);
assert.ok(selectionSource.includes("coverageSatisfied"), "Expected selector diagnostics to include coverageSatisfied.");
assert.ok(selectionSource.includes("freshnessSatisfied"), "Expected selector diagnostics to include freshnessSatisfied.");
assert.ok(selectionSource.includes("recycledCount"), "Expected selector diagnostics to include recycledCount.");
assert.ok(selectionSource.includes("unavailableReason"), "Expected selector diagnostics to include unavailableReason.");
assert.ok(
  !selectionSource.includes("requiresFreshGeneration"),
  "Expected old requiresFreshGeneration contract to be removed."
);

const makeBlueprint = () => ({
  version: "assessment-blueprint-v1",
  outcomes: [
    { key: "mcq-remember", objective: "Recall key facts", bloomLevel: "Remember", evidenceFocus: "fact recall" },
    { key: "mcq-apply", objective: "Apply the concept", bloomLevel: "Apply", evidenceFocus: "applied example" },
    { key: "essay-analyze", objective: "Analyze the topic", bloomLevel: "Analyze", evidenceFocus: "analysis" },
    { key: "essay-create", objective: "Create an argument", bloomLevel: "Create", evidenceFocus: "synthesis" },
  ],
  mcqPlan: {
    allowedBloomLevels: ["Remember", "Understand", "Apply", "Analyze"],
    targetBloomLevels: ["Remember", "Apply"],
    targetOutcomeKeys: ["mcq-remember", "mcq-apply"],
  },
  essayPlan: {
    allowedBloomLevels: ["Analyze", "Evaluate", "Create"],
    targetBloomLevels: ["Analyze", "Create"],
    targetOutcomeKeys: ["essay-analyze", "essay-create"],
    authenticScenarioRequired: false,
  },
});

const makeQuestion = ({ id, text, outcomeKey, bloomLevel, type = "mcq", difficulty = "medium" }) => ({
  _id: id,
  questionText: text,
  questionType: type,
  difficulty,
  outcomeKey,
  bloomLevel,
});

const makeAttempt = (id, questionIds, format = "mcq", answered = true) => ({
  _id: id,
  _creationTime: Date.now() - 60_000,
  examFormat: format,
  topicId: "topic1",
  questionIds,
  answers: answered ? questionIds.map((questionId) => ({ questionId, selectedAnswer: "A" })) : [],
  score: answered ? questionIds.length : 0,
});

const buildMcqPool = (countPerOutcome = 6) => {
  const rememberConcepts = [
    "enzyme",
    "catalyst",
    "mitosis",
    "osmosis",
    "ribosome",
    "neuron",
    "alloy",
    "vector",
    "isotope",
    "glacier",
    "prism",
    "lattice",
  ];
  const applyScenarios = [
    "reactor",
    "workshop",
    "lab",
    "factory",
    "ecosystem",
    "market",
    "bridge",
    "network",
    "harvest",
    "clinic",
    "studio",
    "harbor",
  ];
  const questions = [];
  for (let index = 0; index < countPerOutcome; index += 1) {
    questions.push(
      makeQuestion({
        id: `remember-${index + 1}`,
        text: `Which definition best explains the ${rememberConcepts[index]} concept?`,
        outcomeKey: "mcq-remember",
        bloomLevel: "Remember",
        difficulty: index % 2 === 0 ? "easy" : "medium",
      }),
      makeQuestion({
        id: `apply-${index + 1}`,
        text: `How should the idea be applied in the ${applyScenarios[index]} scenario?`,
        outcomeKey: "mcq-apply",
        bloomLevel: "Apply",
        difficulty: index % 3 === 0 ? "hard" : "medium",
      })
    );
  }
  return questions;
};

// 1. Dedupe still removes duplicate stems before selection.
{
  const deduped = dedupeQuestionsByPrompt([
    makeQuestion({ id: "q1", text: "What is polymorphism?", outcomeKey: "mcq-remember", bloomLevel: "Remember" }),
    makeQuestion({ id: "q2", text: " what is polymorphism ", outcomeKey: "mcq-remember", bloomLevel: "Remember" }),
    makeQuestion({ id: "q3", text: "Apply the concept", outcomeKey: "mcq-apply", bloomLevel: "Apply" }),
  ]);
  assert.equal(deduped.length, 2, "Expected duplicate prompts to collapse before selection.");
}

// 2. First attempt satisfies coverage without recycling.
{
  const result = selectQuestionsForAttempt({
    questions: buildMcqPool(6),
    recentAttempts: [],
    subsetSize: 8,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: makeBlueprint(),
    bankTargetCount: 12,
  });

  assert.equal(result.selectedQuestions.length, 8, "Expected first attempt to build a full subset.");
  assert.equal(result.coverageSatisfied, true, "Expected first attempt to satisfy blueprint coverage.");
  assert.equal(result.freshnessSatisfied, true, "Expected first attempt to be fully fresh.");
  assert.equal(result.recycledCount, 0, "Expected first attempt not to recycle seen questions.");
  assert.equal(result.requiresGeneration, false, "Expected first attempt not to request generation.");
}

// 3. Retake with expandable bank blocks for generation instead of recycling.
{
  const questions = buildMcqPool(6);
  const completedAttempt = makeAttempt("attempt-1", questions.slice(0, 8).map((question) => question._id), "mcq", true);
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [completedAttempt],
    subsetSize: 8,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: makeBlueprint(),
    bankTargetCount: 16,
  });

  assert.equal(result.requiresGeneration, true, "Expected retake to trigger fresh generation while the bank can still grow.");
  assert.equal(result.recycledCount, 0, "Expected expandable retake to avoid recycling.");
  assert.equal(result.freshnessSatisfied, true, "Expected expandable retake selection to stay fully fresh.");
  assert.equal(result.unavailableReason, undefined, "Expected expandable retake not to return a terminal unavailable reason.");
}

// 4. Exhausted bank recycles oldest seen questions to preserve coverage.
{
  const questions = buildMcqPool(10);
  const olderAttemptIds = questions.slice(0, 8).map((question) => question._id);
  const newerAttemptIds = questions.slice(8, 16).map((question) => question._id);
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [makeAttempt("attempt-newer", newerAttemptIds, "mcq", true), makeAttempt("attempt-older", olderAttemptIds, "mcq", true)],
    subsetSize: 8,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: makeBlueprint(),
    bankTargetCount: questions.length,
  });

  const selectedIds = new Set(result.selectedQuestions.map((question) => question._id));
  const olderSelections = olderAttemptIds.filter((questionId) => selectedIds.has(questionId)).length;

  assert.equal(result.selectedQuestions.length, 8, "Expected exhausted bank retake to still build a full subset.");
  assert.equal(result.requiresGeneration, false, "Expected exhausted bank retake not to request more generation.");
  assert.equal(result.freshnessSatisfied, false, "Expected exhausted bank retake to report recycled questions.");
  assert.equal(result.recycledCount, 4, "Expected exhausted bank retake to recycle only the slots that fresh questions could not fill.");
  assert.equal(olderSelections >= 4, true, "Expected recycled selection to prefer the oldest seen questions.");
}

// 5. If exhausted bank cannot satisfy outcome coverage, the selector should return a terminal unavailable reason.
{
  const rememberOnlyConcepts = ["enzyme", "neuron", "isotope", "glacier", "catalyst", "ribosome", "vector", "lattice"];
  const rememberOnlyQuestions = Array.from({ length: 8 }, (_, index) =>
    makeQuestion({
      id: `remember-only-${index + 1}`,
      text: `Which statement best defines the ${rememberOnlyConcepts[index]} idea?`,
      outcomeKey: "mcq-remember",
      bloomLevel: "Remember",
    })
  );
  const result = selectQuestionsForAttempt({
    questions: rememberOnlyQuestions,
    recentAttempts: [],
    subsetSize: 6,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: makeBlueprint(),
    bankTargetCount: rememberOnlyQuestions.length,
  });

  assert.equal(result.requiresGeneration, false, "Expected exhausted coverage failure to stop retrying generation.");
  assert.equal(result.unavailableReason, "MISSING_OUTCOME_COVERAGE", "Expected exhausted coverage failure to return a terminal unavailable reason.");
  assert.equal(result.coverageSatisfied, false, "Expected exhausted coverage failure to report coverage not satisfied.");
}

// 6. Format filtering still prevents essay history from polluting MCQ freshness.
{
  const questions = buildMcqPool(6);
  const essayAttempt = makeAttempt("essay-attempt", ["essay-1", "essay-2"], "essay", true);
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [essayAttempt],
    subsetSize: 8,
    isEssay: false,
    examFormat: "mcq",
    assessmentBlueprint: makeBlueprint(),
    bankTargetCount: 12,
  });

  assert.equal(result.completedAttemptCount, 0, "Expected essay attempts to be ignored for MCQ freshness.");
  assert.equal(result.recycledCount, 0, "Expected essay history not to force MCQ recycling.");
}

console.log("question-repetition-regression.test.mjs passed");
