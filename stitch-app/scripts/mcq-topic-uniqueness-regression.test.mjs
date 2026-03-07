import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  areMcqQuestionsNearDuplicate,
  buildMcqUniquenessSignature,
} from "../convex/lib/mcqUniqueness.js";
import { dedupeQuestionsByPrompt } from "../convex/lib/examQuestionSelection.js";

const buildMcq = ({
  id,
  questionText,
  correctLabel = "B",
  correctText,
  distractors = [],
  citationQuote,
  passageId = "p1-0",
}) => ({
  _id: id,
  questionType: "multiple_choice",
  questionText,
  correctAnswer: correctLabel,
  options: [
    { label: "A", text: distractors[0] || "Incorrect A", isCorrect: correctLabel === "A" },
    { label: "B", text: correctText, isCorrect: correctLabel === "B" },
    { label: "C", text: distractors[1] || "Incorrect C", isCorrect: correctLabel === "C" },
    { label: "D", text: distractors[2] || "Incorrect D", isCorrect: correctLabel === "D" },
  ],
  citations: [
    {
      passageId,
      page: 0,
      startChar: 0,
      endChar: citationQuote.length,
      quote: citationQuote,
    },
  ],
  factualityStatus: "verified",
});

// 1) Same cited fact + same answer should be treated as duplicates even with different wording.
{
  const left = buildMcq({
    id: "q1",
    questionText: "What is the target for the Sales-Active Rate (Weekly)?",
    correctLabel: "B",
    correctText: "20% weekly",
    distractors: ["10% weekly", "15% weekly", "25% weekly"],
    citationQuote: "3) Sales-Active Rate (Weekly)\nTarget: 20% weekly",
    passageId: "p1-1",
  });
  const right = buildMcq({
    id: "q2",
    questionText: "What target sales-active rate should assigned vendors meet each week?",
    correctLabel: "B",
    correctText: "20% weekly",
    distractors: ["10% weekly", "25% weekly", "30% weekly"],
    citationQuote: "3) Sales-Active Rate (Weekly)\nTarget: 20% weekly",
    passageId: "p1-1",
  });

  assert.equal(
    areMcqQuestionsNearDuplicate(buildMcqUniquenessSignature(left), buildMcqUniquenessSignature(right)),
    true,
    "Expected MCQs that cite the same fact with the same answer to be treated as duplicates.",
  );
}

// 2) Dedupe should collapse those duplicates but keep a different fact from the same topic.
{
  const duplicateA = buildMcq({
    id: "q1",
    questionText: "How is a vendor defined as app-adopted in the scorecard?",
    correctText: "Performing at least one meaningful in-app action during the week",
    distractors: [
      "Logging in once during the week",
      "Making one sale during the week",
      "Updating inventory once during the week",
    ],
    citationQuote: "A vendor is counted as app-adopted if they performed at least one meaningful in-app action during the week.",
    passageId: "p1-0",
  });
  const duplicateB = buildMcq({
    id: "q2",
    questionText: "What makes a vendor app-adopted according to the KPI scorecard?",
    correctText: "Performing at least one meaningful in-app action during the week",
    distractors: [
      "Viewing the dashboard",
      "Selling one item",
      "Resetting the password",
    ],
    citationQuote: "A vendor is counted as app-adopted if they performed at least one meaningful in-app action during the week.",
    passageId: "p1-0",
  });
  const unique = buildMcq({
    id: "q3",
    questionText: "What is the target number of new vendors to add each week?",
    correctText: "10 new vendors per week",
    distractors: ["5 new vendors per week", "15 new vendors per week", "20 new vendors per week"],
    citationQuote: "4) New Vendors Added (Weekly)\nTarget: 10 new vendors per week",
    passageId: "p1-1",
  });

  const deduped = dedupeQuestionsByPrompt([duplicateA, duplicateB, unique]);
  assert.equal(deduped.length, 2, "Expected only unique MCQs to remain after dedupe.");
}

// 3) Same passage but different answer-supported facts should remain distinct.
{
  const targetQuestion = buildMcq({
    id: "q1",
    questionText: "What is the target for the Sales-Active Rate (Weekly)?",
    correctLabel: "B",
    correctText: "20% weekly",
    distractors: ["10% weekly", "15% weekly", "25% weekly"],
    citationQuote: "3) Sales-Active Rate (Weekly)\nTarget: 20% weekly Measures: Share of assigned vendors who made at least one sale in the week.",
    passageId: "p1-1",
  });
  const definitionQuestion = buildMcq({
    id: "q2",
    questionText: "What defines a sales-active vendor?",
    correctText: "Vendor has at least one completed sale in the week",
    distractors: [
      "Vendor has at least one completed sale in the month",
      "Vendor has at least one completed sale in the day",
      "Vendor has at least one completed sale in the quarter",
    ],
    citationQuote: "3) Sales-Active Rate (Weekly)\nTarget: 20% weekly Measures: Share of assigned vendors who made at least one sale in the week. Sales-active definition: Vendor has at least one completed sale in the week.",
    passageId: "p1-1",
  });

  assert.equal(
    areMcqQuestionsNearDuplicate(buildMcqUniquenessSignature(targetQuestion), buildMcqUniquenessSignature(definitionQuestion)),
    false,
    "Expected different evidence-backed facts from the same passage to remain distinct.",
  );
}

// 4) Persistence/read-path hooks should be wired in the topic layer.
{
  const topicsSource = await fs.readFile(path.join(process.cwd(), "convex", "topics.ts"), "utf8");
  assert.equal(
    /dedupeTopicQuestions/.test(topicsSource) && /areMcqQuestionsNearDuplicate/.test(topicsSource),
    true,
    "Expected topics.ts to dedupe MCQs and reject duplicate inserts.",
  );
}

console.log("mcq-topic-uniqueness-regression.test.mjs passed");
