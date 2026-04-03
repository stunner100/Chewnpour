import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { selectQuestionsForAttempt } from "../convex/lib/examQuestionSelection.js";
import {
    HARD_OBJECTIVE_DIFFICULTY_DISTRIBUTION,
    PREMIUM_MIN_QUESTION_SCORE,
    evaluateObjectiveQuestionQuality,
    passesObjectivePremiumQuality,
} from "../convex/lib/premiumQuality.js";

const root = process.cwd();
const read = async (relativePath) =>
    fs.readFile(path.join(root, relativePath), "utf8");

const groundedGenerationSource = await read("convex/lib/groundedGeneration.ts");
const aiSource = await read("convex/ai.ts");
const selectionSource = await read("convex/lib/examQuestionSelection.js");

assert.equal(
    groundedGenerationSource.includes("MCQ outcomes should support only: Apply, Analyze."),
    true,
    "Expected grounded assessment blueprint prompt to target Apply/Analyze MCQ outcomes."
);

assert.equal(
    groundedGenerationSource.includes("Question must require application, interpretation, diagnosis, comparison, or scenario evaluation."),
    true,
    "Expected grounded MCQ prompt to require applied or analytical stems."
);

assert.equal(
    groundedGenerationSource.includes("roughly 10% easy, 30% medium, 60% hard"),
    true,
    "Expected grounded MCQ prompt to encode the harder default difficulty mix."
);

assert.equal(
    aiSource.includes('"bloomLevel": "Apply|Analyze"'),
    true,
    "Expected MCQ repair schema in ai.ts to reject Remember/Understand."
);

assert.equal(
    selectionSource.includes("HARD_OBJECTIVE_DIFFICULTY_DISTRIBUTION"),
    true,
    "Expected objective exam selection to use the harder difficulty distribution."
);

assert.deepEqual(
    HARD_OBJECTIVE_DIFFICULTY_DISTRIBUTION,
    { easy: 0.1, medium: 0.3, hard: 0.6 },
    "Expected objective exams to skew heavily hard by default."
);

const buildQuestion = ({
    id,
    difficulty = "hard",
    bloomLevel = "Analyze",
    questionText = "A student is given a scenario and must diagnose which evidence-backed explanation best applies.",
}) => ({
    _id: id,
    questionText,
    difficulty,
    bloomLevel,
    learningObjective: "Apply the topic evidence to a realistic case and choose the strongest interpretation.",
    explanation: "The correct answer follows directly from the evidence and the scenario constraints.",
    groundingScore: 0.94,
    options: [
        { label: "A", text: "Interpret the scenario using the first evidence-backed principle.", isCorrect: true },
        { label: "B", text: "Apply an unrelated definition without considering the scenario.", isCorrect: false },
        { label: "C", text: "Choose the option that ignores the stated constraint.", isCorrect: false },
        { label: "D", text: "Select a plausible but unsupported diagnosis.", isCorrect: false },
    ],
});

const VARIANT_TOKENS = [
    "hospital",
    "classroom",
    "factory",
    "courtroom",
    "laboratory",
    "supply chain",
    "farm",
    "airport",
    "bank",
    "server room",
];

const HARD_PROMPTS = [
    "A hospital triage team must diagnose which evidence-backed explanation best accounts for the patient's sudden decline.",
    "During a classroom intervention, a teacher must determine which evidence-backed strategy best addresses the student's misconception.",
    "A factory supervisor compares two failure reports and must diagnose which evidence-backed root cause best fits the breakdown.",
    "A courtroom analyst must interpret conflicting statements and decide which evidence-backed claim is most defensible.",
    "In a laboratory audit, a researcher must diagnose which evidence-backed explanation best accounts for the anomalous result.",
    "A supply-chain manager must compare competing recovery plans and choose the evidence-backed explanation for the delay pattern.",
    "A farm adviser must analyze crop symptoms and determine which evidence-backed diagnosis best explains the field losses.",
    "An airport operations lead must interpret the disruption signals and diagnose which evidence-backed factor caused the cascade.",
    "A bank compliance officer must compare two transaction patterns and determine which evidence-backed risk explanation best applies.",
    "A server-room engineer must diagnose which evidence-backed explanation best accounts for the repeated outage pattern.",
];

const MEDIUM_PROMPTS = [
    "In a hospital handoff, which evidence-backed action should the team apply next?",
    "Given a classroom observation, which evidence-backed action should the teacher apply next?",
    "After reviewing a factory checklist, which evidence-backed action should the supervisor apply next?",
    "Given the courtroom notes, which evidence-backed action should the analyst apply next?",
    "After the laboratory review, which evidence-backed action should the researcher apply next?",
    "Given the supply-chain update, which evidence-backed action should the manager apply next?",
    "After the farm inspection, which evidence-backed action should the adviser apply next?",
    "Given the airport incident log, which evidence-backed action should operations apply next?",
    "After reviewing the bank report, which evidence-backed action should compliance apply next?",
    "Given the server-room alert summary, which evidence-backed action should the engineer apply next?",
];

const EASY_PROMPTS = [
    "Which detail in the hospital case best matches the evidence-backed example?",
    "Which detail in the classroom case best matches the evidence-backed example?",
    "Which detail in the factory case best matches the evidence-backed example?",
    "Which detail in the courtroom case best matches the evidence-backed example?",
    "Which detail in the laboratory case best matches the evidence-backed example?",
    "Which detail in the supply-chain case best matches the evidence-backed example?",
    "Which detail in the farm case best matches the evidence-backed example?",
    "Which detail in the airport case best matches the evidence-backed example?",
    "Which detail in the bank case best matches the evidence-backed example?",
    "Which detail in the server-room case best matches the evidence-backed example?",
];

{
    const questions = [
        ...Array.from({ length: 10 }, (_, index) =>
            buildQuestion({
                id: `hard-${index + 1}`,
                difficulty: "hard",
                questionText: HARD_PROMPTS[index],
            })
        ),
        ...Array.from({ length: 10 }, (_, index) =>
            buildQuestion({
                id: `medium-${index + 1}`,
                difficulty: "medium",
                bloomLevel: "Apply",
                questionText: MEDIUM_PROMPTS[index],
            })
        ),
        ...Array.from({ length: 10 }, (_, index) =>
            buildQuestion({
                id: `easy-${index + 1}`,
                difficulty: "easy",
                bloomLevel: "Apply",
                questionText: EASY_PROMPTS[index],
            })
        ),
    ];
    const result = selectQuestionsForAttempt({
        questions,
        recentAttempts: [],
        subsetSize: 10,
        isEssay: false,
        examFormat: "mcq",
    });
    const counts = result.selectedQuestions.reduce((acc, question) => {
        const key = String(question?.difficulty || "medium").toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    assert.equal(counts.hard, 6, "Expected 60% of a 10-question objective exam to be hard.");
    assert.equal(counts.medium, 3, "Expected 30% of a 10-question objective exam to be medium.");
    assert.equal(counts.easy, 1, "Expected 10% of a 10-question objective exam to be easy.");
}

{
    const questions = [
        ...Array.from({ length: 2 }, (_, index) =>
            buildQuestion({
                id: `hard-short-${index + 1}`,
                difficulty: "hard",
                questionText: HARD_PROMPTS[index],
            })
        ),
        ...Array.from({ length: 10 }, (_, index) =>
            buildQuestion({
                id: `medium-fill-${index + 1}`,
                difficulty: "medium",
                bloomLevel: "Apply",
                questionText: MEDIUM_PROMPTS[index],
            })
        ),
        ...Array.from({ length: 10 }, (_, index) =>
            buildQuestion({
                id: `easy-fill-${index + 1}`,
                difficulty: "easy",
                bloomLevel: "Apply",
                questionText: EASY_PROMPTS[index],
            })
        ),
    ];
    const result = selectQuestionsForAttempt({
        questions,
        recentAttempts: [],
        subsetSize: 10,
        isEssay: false,
        examFormat: "mcq",
    });
    const counts = result.selectedQuestions.reduce((acc, question) => {
        const key = String(question?.difficulty || "medium").toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    assert.equal(counts.hard, 2, "Expected the selector to use every available hard question first.");
    assert.equal(counts.medium, 7, "Expected medium questions to backfill most missing hard slots.");
    assert.equal(counts.easy, 1, "Expected easy questions to remain a minimal final fallback.");
}

{
    const strongQuestion = buildQuestion({
        id: "strong",
        difficulty: "hard",
        bloomLevel: "Analyze",
        questionText: "A clinician compares two evidence-backed response plans for a patient scenario. Which option best explains the safer diagnosis?",
    });
    const weakQuestion = {
        _id: "weak",
        difficulty: "easy",
        bloomLevel: "Remember",
        questionText: "What is osmosis?",
        learningObjective: "Recall the textbook definition of osmosis.",
        explanation: "Osmosis is the definition stated in the notes.",
        groundingScore: 0.9,
        options: [
            { label: "A", text: "A definition copied from memory", isCorrect: true },
            { label: "B", text: "All of the above", isCorrect: false },
            { label: "C", text: "None of the above", isCorrect: false },
            { label: "D", text: "A short unsupported phrase", isCorrect: false },
        ],
    };

    const strongQuality = evaluateObjectiveQuestionQuality(strongQuestion);
    const weakQuality = evaluateObjectiveQuestionQuality(weakQuestion);

    assert.equal(
        strongQuality.qualityScore >= PREMIUM_MIN_QUESTION_SCORE,
        true,
        "Expected strong scenario-based objective questions to clear the new quality floor."
    );
    assert.equal(
        passesObjectivePremiumQuality(strongQuestion),
        true,
        "Expected high-rigor scenario questions to pass the premium quality gate."
    );
    assert.equal(
        passesObjectivePremiumQuality(weakQuestion),
        false,
        "Expected recall-style definition questions to fail the harder objective gate."
    );
    assert.equal(
        weakQuality.qualityFlags.includes("recall_style"),
        true,
        "Expected the quality evaluator to flag recall-style stems."
    );
}

console.log("objective-exam-hardening-regression.test.mjs passed");
