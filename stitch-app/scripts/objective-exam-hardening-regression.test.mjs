import assert from "node:assert/strict";

import {
  DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION,
  normalizeAssessmentBlueprint,
} from "../convex/lib/assessmentBlueprint.js";
import { selectQuestionsForAttempt } from "../convex/lib/examQuestionSelection.js";
import {
  OBJECTIVE_EXAM_FORMAT,
  QUESTION_TYPE_FILL_BLANK,
  QUESTION_TYPE_MULTIPLE_CHOICE,
  QUESTION_TYPE_TRUE_FALSE,
} from "../convex/lib/objectiveExam.js";
import { evaluateQuestionQuality } from "../convex/lib/premiumQuality.js";

const rawBlueprint = {
  outcomes: [
    {
      key: "recall-facts",
      objective: "Recall the named policy elements.",
      bloomLevel: "Understand",
      evidenceFocus: "Explicit definitions from the notes.",
      cognitiveTask: "explain",
      difficultyBand: "easy",
    },
    {
      key: "apply-procedure",
      objective: "Apply the procedure to a live operational case.",
      bloomLevel: "Apply",
      evidenceFocus: "Operational rules and escalation criteria.",
      cognitiveTask: "apply",
      difficultyBand: "medium",
      scenarioFrame: "A departmental operations review",
    },
    {
      key: "analyze-tradeoffs",
      objective: "Analyze the tradeoffs in a scenario-backed decision.",
      bloomLevel: "Analyze",
      evidenceFocus: "Tradeoffs, decision points, and constraints.",
      cognitiveTask: "analyze",
      difficultyBand: "hard",
      scenarioFrame: "A university leadership case conference",
    },
    {
      key: "essay-synthesis",
      objective: "Synthesize the evidence into a defensible argument.",
      bloomLevel: "Analyze",
      evidenceFocus: "Synthesis and justification.",
      cognitiveTask: "justify",
      difficultyBand: "hard",
      scenarioFrame: "A policy memorandum",
    },
  ],
  objectivePlan: {
    targetQuestionTypes: ["multiple_choice", "true_false", "fill_blank"],
    targetOutcomeKeys: ["recall-facts", "apply-procedure", "analyze-tradeoffs"],
  },
  multipleChoicePlan: {},
  trueFalsePlan: {},
  fillBlankPlan: {
    tokenBankRequired: true,
    exactAnswerOnly: true,
  },
  essayPlan: {
    targetOutcomeKeys: ["essay-synthesis"],
  },
};

const normalizedBlueprint = normalizeAssessmentBlueprint(rawBlueprint);
assert.ok(normalizedBlueprint, "Expected assessment blueprint to normalize.");
assert.deepEqual(
  normalizedBlueprint.objectivePlan.targetDifficultyDistribution,
  DEFAULT_OBJECTIVE_DIFFICULTY_DISTRIBUTION,
  "Expected harder default objective difficulty distribution."
);
assert.deepEqual(
  normalizedBlueprint.multipleChoicePlan.targetBloomLevels,
  ["Apply", "Analyze"],
  "Expected multiple-choice target blooms to prefer Apply and Analyze when available."
);
assert.deepEqual(
  normalizedBlueprint.trueFalsePlan.targetBloomLevels,
  ["Apply"],
  "Expected true/false target blooms to prefer Apply when available."
);
assert.deepEqual(
  normalizedBlueprint.fillBlankPlan.targetBloomLevels,
  ["Apply"],
  "Expected fill-blank target blooms to prefer Apply when available."
);

const toughCandidateQuality = evaluateQuestionQuality({
  questionType: QUESTION_TYPE_MULTIPLE_CHOICE,
  questionText:
    "A department must reduce incident escalation delays without adding staff. Which interpretation of the evidence best supports the safest first intervention?",
  bloomLevel: "Analyze",
  cognitiveTask: "diagnose",
  difficulty: "hard",
  outcomeKey: "analyze-tradeoffs",
  authenticContext: "A university operations review",
  groundingScore: 0.94,
  citations: [{ passageId: "p1" }, { passageId: "p2" }, { passageId: "p3" }],
  options: [
    { label: "A", text: "Introduce a triage checkpoint before escalation so low-risk cases are closed earlier.", isCorrect: true },
    { label: "B", text: "Escalate every case immediately because more escalation always improves response time.", isCorrect: false },
    { label: "C", text: "Remove verification steps so tickets move faster regardless of accuracy.", isCorrect: false },
    { label: "D", text: "Delay categorization until the end of the shift to avoid interruptions.", isCorrect: false },
  ],
});
assert.equal(
  toughCandidateQuality.qualityTier,
  "premium",
  "Expected scenario-based analytical objective items to clear the premium gate."
);

const recallCandidateQuality = evaluateQuestionQuality({
  questionType: QUESTION_TYPE_MULTIPLE_CHOICE,
  questionText: "What is the definition of escalation?",
  bloomLevel: "Remember",
  cognitiveTask: "define",
  difficulty: "easy",
  outcomeKey: "recall-facts",
  groundingScore: 0.95,
  citations: [{ passageId: "p1" }],
  options: [
    { label: "A", text: "Sending something upward in a process.", isCorrect: true },
    { label: "B", text: "Closing a case immediately.", isCorrect: false },
    { label: "C", text: "A training activity.", isCorrect: false },
    { label: "D", text: "All of the above.", isCorrect: false },
  ],
});
assert.equal(
  recallCandidateQuality.qualityTier,
  "limited",
  "Expected direct recall items to fail the stricter premium gate."
);

const withQuality = (question) => {
  const quality = evaluateQuestionQuality(question);
  return {
    ...question,
    ...quality.qualitySignals,
    qualityTier: quality.qualityTier,
  };
};

const selectionBlueprint = {
  outcomes: [
    {
      key: "apply-procedure",
      objective: "Apply the procedure to a live operational case.",
      bloomLevel: "Apply",
      evidenceFocus: "Operational rules and escalation criteria.",
      cognitiveTask: "apply",
      difficultyBand: "medium",
      scenarioFrame: "A departmental operations review",
    },
    {
      key: "essay-synthesis",
      objective: "Synthesize the evidence into a defensible argument.",
      bloomLevel: "Analyze",
      evidenceFocus: "Synthesis and justification.",
      cognitiveTask: "justify",
      difficultyBand: "hard",
      scenarioFrame: "A policy memorandum",
    },
  ],
  objectivePlan: {
    targetQuestionTypes: ["multiple_choice", "true_false", "fill_blank"],
    targetOutcomeKeys: ["apply-procedure"],
    minDistinctOutcomeCount: 1,
  },
  multipleChoicePlan: {
    targetOutcomeKeys: ["apply-procedure"],
  },
  trueFalsePlan: {
    targetOutcomeKeys: ["apply-procedure"],
  },
  fillBlankPlan: {
    targetOutcomeKeys: ["apply-procedure"],
    tokenBankRequired: true,
    exactAnswerOnly: true,
  },
  essayPlan: {
    targetOutcomeKeys: ["essay-synthesis"],
  },
};

const MCQ_PROMPTS = [
  "A procurement chair sees low-risk purchases waiting for escalation. Which first move is most defensible from the evidence?",
  "Lab safety records show recurring routing delays. What should the coordinator do before forwarding the case?",
  "Which student-support case most clearly requires immediate escalation under the evidence-based triage rule?",
  "What is the strongest evidence-based criticism of escalating every IT ticket at intake?",
  "Which routing change best addresses the registrar bottleneck described in the evidence?",
  "Facilities leadership is revising backlog triage. Which criterion should be checked first before escalation?",
];

const TRUE_FALSE_STATEMENTS = [
  "In an admissions review workflow, the evidence supports triaging low-risk requests before escalating them to senior review.",
  "In a bursary escalation queue, the evidence supports escalating every request immediately regardless of urgency.",
  "In an academic appeals triage case, the evidence supports checking routing criteria before assigning the case to a decision panel.",
  "In a records-verification handoff, the evidence supports skipping the intake checkpoint when the queue is busy.",
];

const FILL_BLANK_PROMPTS = [
  "When processing a disciplinary review intake, the team should __ the case before routing it onward.",
  "When the procurement team reaches the screening checkpoint, staff should __ the request before escalation.",
  "When responding to a library incident under the policy, the first step is to __ the issue before handing it off.",
];

const makeMcq = (index, difficulty) =>
  withQuality({
    _id: `mcq-${index}`,
    topicId: "topic-hardening",
    questionType: QUESTION_TYPE_MULTIPLE_CHOICE,
    questionText: MCQ_PROMPTS[index - 1],
    difficulty,
    bloomLevel: "Apply",
    cognitiveTask: "apply",
    outcomeKey: "apply-procedure",
    authenticContext: "A university operations case review",
    groundingScore: difficulty === "hard" ? 0.93 : 0.89,
    citations: [
      { passageId: `mcq-${index}-a`, quote: `mcq evidence ${index}a` },
      { passageId: `mcq-${index}-b`, quote: `mcq evidence ${index}b` },
    ],
    options: [
      { label: "A", text: `Best supported intervention ${index}`, isCorrect: true },
      { label: "B", text: `Unsupported shortcut ${index}`, isCorrect: false },
      { label: "C", text: `Unsafe escalation ${index}`, isCorrect: false },
      { label: "D", text: `Irrelevant policy change ${index}`, isCorrect: false },
    ],
    correctAnswer: "A",
  });

const makeTrueFalse = (index, difficulty) =>
  withQuality({
    _id: `tf-${index}`,
    topicId: "topic-hardening",
    questionType: QUESTION_TYPE_TRUE_FALSE,
    questionText: TRUE_FALSE_STATEMENTS[index - 1],
    difficulty,
    bloomLevel: "Apply",
    cognitiveTask: "apply",
    outcomeKey: "apply-procedure",
    authenticContext: "A workflow handoff case",
    groundingScore: difficulty === "hard" ? 0.91 : 0.87,
    citations: [
      { passageId: `tf-${index}-a`, quote: `tf evidence ${index}a` },
      { passageId: `tf-${index}-b`, quote: `tf evidence ${index}b` },
    ],
    options: [
      { label: "A", text: "True", isCorrect: true },
      { label: "B", text: "False", isCorrect: false },
    ],
    correctAnswer: "A",
  });

const makeFillBlank = (index, difficulty) =>
  withQuality({
    _id: `fb-${index}`,
    topicId: "topic-hardening",
    questionType: QUESTION_TYPE_FILL_BLANK,
    questionText: FILL_BLANK_PROMPTS[index - 1],
    difficulty,
    bloomLevel: "Apply",
    cognitiveTask: "apply",
    outcomeKey: "apply-procedure",
    authenticContext: "A staged escalation scenario",
    groundingScore: difficulty === "hard" ? 0.9 : 0.86,
    citations: [
      { passageId: `fb-${index}-a`, quote: `fb evidence ${index}a` },
      { passageId: `fb-${index}-b`, quote: `fb evidence ${index}b` },
    ],
    templateParts: [
      "When processing the case, the team should ",
      "__",
      " it before routing the request onward.",
    ],
    acceptedAnswers: ["triage"],
    tokens: ["triage", "archive", "ignore", "duplicate"],
    fillBlankMode: "token_bank",
    correctAnswer: "triage",
  });

const objectiveBank = [
  makeMcq(1, "hard"),
  makeMcq(2, "hard"),
  makeMcq(3, "hard"),
  makeMcq(4, "medium"),
  makeMcq(5, "medium"),
  makeMcq(6, "easy"),
  makeTrueFalse(1, "hard"),
  makeTrueFalse(2, "medium"),
  makeTrueFalse(3, "medium"),
  makeTrueFalse(4, "easy"),
  makeFillBlank(1, "hard"),
  makeFillBlank(2, "medium"),
  makeFillBlank(3, "easy"),
];

const selection = selectQuestionsForAttempt({
  questions: objectiveBank,
  recentAttempts: [],
  subsetSize: 10,
  isEssay: false,
  examFormat: OBJECTIVE_EXAM_FORMAT,
  assessmentBlueprint: selectionBlueprint,
  bankTargetCount: 10,
});

assert.equal(selection.selectedQuestions.length, 10, "Expected a full objective exam set.");
const breakdown = selection.selectedQuestions.reduce((acc, question) => {
  acc[question.questionType] = (acc[question.questionType] || 0) + 1;
  return acc;
}, {});
assert.deepEqual(
  breakdown,
  {
    [QUESTION_TYPE_MULTIPLE_CHOICE]: 5,
    [QUESTION_TYPE_TRUE_FALSE]: 3,
    [QUESTION_TYPE_FILL_BLANK]: 2,
  },
  "Expected the harder selector to preserve the current objective subtype mix."
);
assert.equal(
  selection.selectedQuestions.some((question) => question.difficulty === "easy"),
  false,
  "Expected medium questions to backfill hard shortages before any easy items are selected."
);

console.log("objective-exam-hardening-regression.test.mjs passed");
