import { isUsableExamQuestion } from "../convex/lib/examSecurity.js";

const question = {
  questionType: "multiple_choice",
  questionText: "How does the evidence support keeping a human in the loop?",
  options: [
    {
      label: "A",
      text: "A human should review AI output during the first rollout.",
      isCorrect: true,
    },
    {
      label: "B",
      text: "AI should approve every business decision by itself.",
      isCorrect: false,
    },
    {
      label: "C",
      text: "The workflow should be expanded before it is useful.",
      isCorrect: false,
    },
    {
      label: "D",
      text: "Documentation should be skipped after implementation.",
      isCorrect: false,
    },
  ],
  correctAnswer: "A",
};

if (!isUsableExamQuestion(question, { allowEssay: false })) {
  throw new Error("Expected ordinary uses of the word 'be' to pass objective exam validation.");
}

console.log("exam-question-be-word-regression.test.mjs passed");
