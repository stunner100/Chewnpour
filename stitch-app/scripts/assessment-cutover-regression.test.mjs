import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
    ASSESSMENT_BLUEPRINT_VERSION,
    ESSAY_ALLOWED_BLOOM_LEVELS,
    MCQ_ALLOWED_BLOOM_LEVELS,
    filterQuestionsForActiveAssessment,
    getAssessmentQuestionMetadataIssues,
    isAssessmentV1Question,
    normalizeAssessmentBlueprint,
} from "../convex/lib/assessmentBlueprint.js";

const root = process.cwd();
const read = async (relativePath) =>
    fs.readFile(path.join(root, relativePath), "utf8");

const blueprint = normalizeAssessmentBlueprint({
    outcomes: [
        {
            key: "remember facts",
            objective: "Recall the core facts from the evidence",
            bloomLevel: "remember",
            evidenceFocus: "Foundational factual statements",
        },
        {
            key: "apply analysis",
            objective: "Apply the evidence to a realistic case",
            bloomLevel: "Apply",
            evidenceFocus: "Procedural or contextual application points",
        },
        {
            key: "evaluate claims",
            objective: "Evaluate the strength of the evidence",
            bloomLevel: "Evaluate",
            evidenceFocus: "Analytical tradeoffs and judgment",
        },
    ],
    mcqPlan: {
        targetOutcomeKeys: ["remember facts", "apply analysis"],
    },
    essayPlan: {
        targetOutcomeKeys: ["evaluate claims"],
        authenticScenarioRequired: true,
        authenticContextHint: "Use a realistic institutional scenario",
    },
});

if (!blueprint) {
    throw new Error("Expected a valid normalized assessment blueprint.");
}

if (blueprint.version !== ASSESSMENT_BLUEPRINT_VERSION) {
    throw new Error("Expected normalized blueprint to stamp the assessment-v1 version.");
}

if (!blueprint.mcqPlan.targetBloomLevels.every((level) => MCQ_ALLOWED_BLOOM_LEVELS.includes(level))) {
    throw new Error("Expected MCQ blueprint targets to remain within allowed Bloom levels.");
}

if (!blueprint.essayPlan.targetBloomLevels.every((level) => ESSAY_ALLOWED_BLOOM_LEVELS.includes(level))) {
    throw new Error("Expected essay blueprint targets to remain within allowed Bloom levels.");
}

const mcqQuestion = {
    questionType: "multiple_choice",
    generationVersion: ASSESSMENT_BLUEPRINT_VERSION,
    questionText: "Which fact is stated in the evidence?",
    outcomeKey: blueprint.mcqPlan.targetOutcomeKeys[0],
    bloomLevel: "Remember",
};

const legacyQuestion = {
    questionType: "multiple_choice",
    generationVersion: "grounded-v3",
    questionText: "Legacy question",
};

const invalidAssessmentQuestion = {
    questionType: "essay",
    generationVersion: ASSESSMENT_BLUEPRINT_VERSION,
    questionText: "Evaluate the claim using the evidence.",
    outcomeKey: blueprint.essayPlan.targetOutcomeKeys[0],
    bloomLevel: "Evaluate",
};

if (!isAssessmentV1Question(mcqQuestion, { blueprint })) {
    throw new Error("Expected valid assessment-v1 MCQ to pass active-assessment filter.");
}

if (isAssessmentV1Question(legacyQuestion, { blueprint })) {
    throw new Error("Expected legacy question versions to be excluded from assessment-v1.");
}

const essayIssues = getAssessmentQuestionMetadataIssues({
    question: invalidAssessmentQuestion,
    blueprint,
    questionType: "essay",
});
if (!essayIssues.includes("missing authenticContext")) {
    throw new Error("Expected authentic essay questions to require authenticContext when the blueprint demands it.");
}

const topicWithoutBlueprint = {
    title: "Legacy topic",
};
const topicWithBlueprint = {
    title: "Migrated topic",
    assessmentBlueprint: blueprint,
};

const legacyVisibleBeforeCutover = filterQuestionsForActiveAssessment({
    topic: topicWithoutBlueprint,
    questions: [legacyQuestion, mcqQuestion],
});
if (legacyVisibleBeforeCutover.length !== 2) {
    throw new Error("Expected legacy questions to remain visible before blueprint cutover.");
}

const activeAfterCutover = filterQuestionsForActiveAssessment({
    topic: topicWithBlueprint,
    questions: [legacyQuestion, mcqQuestion, invalidAssessmentQuestion],
});
if (activeAfterCutover.length !== 1 || activeAfterCutover[0]?.questionText !== mcqQuestion.questionText) {
    throw new Error("Expected migrated topics to keep only valid assessment-v1 questions active.");
}

const topicsSource = await read("convex/topics.ts");
const examsSource = await read("convex/exams.ts");
const aiSource = await read("convex/ai.ts");

if (!topicsSource.includes("const rawQuestions = await ctx.db")) {
    throw new Error("Expected internal topic query to reload raw question documents.");
}

if (!topicsSource.includes("questions: activeQuestions,")) {
    throw new Error("Expected internal topic payload to return raw active questions after cutover filtering.");
}

if (!examsSource.includes("const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });")) {
    throw new Error("Expected exam start flow to use the active-assessment question bank.");
}

if (!aiSource.includes("export const regenerateAssessmentQuestionBankInternal = internalAction({")) {
    throw new Error("Expected dedicated internal regeneration path for assessment-v1 question banks.");
}

console.log("assessment-cutover-regression.test.mjs passed");
