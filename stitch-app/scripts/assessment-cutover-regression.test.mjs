import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
    ASSESSMENT_BLUEPRINT_VERSION,
    ESSAY_ALLOWED_BLOOM_LEVELS,
    FILL_BLANK_ALLOWED_BLOOM_LEVELS,
    MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS,
    TRUE_FALSE_ALLOWED_BLOOM_LEVELS,
    filterQuestionsForActiveAssessment,
    getAssessmentQuestionMetadataIssues,
    isAssessmentV2Question,
    normalizeAssessmentBlueprint,
} from "../convex/lib/assessmentBlueprint.js";

const root = process.cwd();
const read = async (relativePath) =>
    fs.readFile(path.join(root, relativePath), "utf8");

const blueprint = normalizeAssessmentBlueprint({
    outcomes: [
        {
            key: "remember-facts",
            objective: "Recall the core facts from the evidence",
            bloomLevel: "Remember",
            evidenceFocus: "Foundational factual statements",
            cognitiveTask: "identify",
            difficultyBand: "easy",
        },
        {
            key: "apply-analysis",
            objective: "Apply the evidence to a realistic case",
            bloomLevel: "Apply",
            evidenceFocus: "Procedural or contextual application points",
            cognitiveTask: "apply",
            difficultyBand: "medium",
            scenarioFrame: "A realistic institutional scenario",
        },
        {
            key: "evaluate-claims",
            objective: "Evaluate the strength of the evidence",
            bloomLevel: "Evaluate",
            evidenceFocus: "Analytical tradeoffs and judgment",
            cognitiveTask: "justify",
            difficultyBand: "hard",
            scenarioFrame: "An evidence review memo",
        },
    ],
    objectivePlan: {
        targetQuestionTypes: ["multiple_choice", "true_false", "fill_blank"],
        targetMix: {
            multiple_choice: 5,
            true_false: 3,
            fill_blank: 2,
        },
        targetOutcomeKeys: ["remember-facts", "apply-analysis"],
        targetDifficultyDistribution: {
            easy: 0.2,
            medium: 0.5,
            hard: 0.3,
        },
        minDistinctOutcomeCount: 3,
    },
    multipleChoicePlan: {
        targetOutcomeKeys: ["remember-facts", "apply-analysis"],
    },
    trueFalsePlan: {
        targetOutcomeKeys: ["remember-facts", "apply-analysis"],
    },
    fillBlankPlan: {
        targetOutcomeKeys: ["remember-facts", "apply-analysis"],
        tokenBankRequired: true,
        exactAnswerOnly: true,
    },
    essayPlan: {
        targetOutcomeKeys: ["evaluate-claims"],
        authenticScenarioRequired: true,
        authenticContextHint: "Use a realistic institutional scenario",
        minDistinctOutcomeCount: 2,
        minDistinctScenarioFrameCount: 2,
    },
});

if (!blueprint) {
    throw new Error("Expected a valid normalized assessment blueprint.");
}

if (blueprint.version !== ASSESSMENT_BLUEPRINT_VERSION) {
    throw new Error("Expected normalized blueprint to stamp the assessment-blueprint-v4 version.");
}

if (blueprint.objectivePlan.targetMix.multiple_choice !== 5 || blueprint.objectivePlan.targetMix.true_false !== 3 || blueprint.objectivePlan.targetMix.fill_blank !== 2) {
    throw new Error("Expected blueprint objective mix to remain 5/3/2.");
}

if (!blueprint.outcomes.every((outcome) => outcome.cognitiveTask && outcome.difficultyBand)) {
    throw new Error("Expected normalized premium blueprint outcomes to include cognitiveTask and difficultyBand.");
}

if (blueprint.objectivePlan.minDistinctOutcomeCount < 2) {
    throw new Error("Expected premium objective blueprint to preserve a distinct outcome floor.");
}

if (blueprint.essayPlan.minDistinctOutcomeCount < 1 || blueprint.essayPlan.minDistinctScenarioFrameCount < 1) {
    throw new Error("Expected premium essay blueprint to preserve diversity floors.");
}

if (!blueprint.multipleChoicePlan.targetBloomLevels.every((level) => MULTIPLE_CHOICE_ALLOWED_BLOOM_LEVELS.includes(level))) {
    throw new Error("Expected multiple-choice blueprint targets to remain within allowed Bloom levels.");
}

if (!blueprint.trueFalsePlan.targetBloomLevels.every((level) => TRUE_FALSE_ALLOWED_BLOOM_LEVELS.includes(level))) {
    throw new Error("Expected true/false blueprint targets to remain within allowed Bloom levels.");
}

if (!blueprint.fillBlankPlan.targetBloomLevels.every((level) => FILL_BLANK_ALLOWED_BLOOM_LEVELS.includes(level))) {
    throw new Error("Expected fill-blank blueprint targets to remain within allowed Bloom levels.");
}

if (!blueprint.essayPlan.targetBloomLevels.every((level) => ESSAY_ALLOWED_BLOOM_LEVELS.includes(level))) {
    throw new Error("Expected essay blueprint targets to remain within allowed Bloom levels.");
}

const validMultipleChoiceQuestion = {
    questionType: "multiple_choice",
    generationVersion: ASSESSMENT_BLUEPRINT_VERSION,
    questionText: "In a realistic institutional scenario, which action best applies the procedural or contextual application points from the evidence?",
    outcomeKey: blueprint.multipleChoicePlan.targetOutcomeKeys[1],
    bloomLevel: "Apply",
};

const validTrueFalseQuestion = {
    questionType: "true_false",
    generationVersion: ASSESSMENT_BLUEPRINT_VERSION,
    questionText: "The foundational factual statements in the evidence support the claim that the process has two stages.",
    outcomeKey: blueprint.trueFalsePlan.targetOutcomeKeys[0],
    bloomLevel: "Remember",
};

const validFillBlankQuestion = {
    questionType: "fill_blank",
    generationVersion: ASSESSMENT_BLUEPRINT_VERSION,
    questionText: "The evidence review memo should begin with the phrase __.",
    templateParts: ["The evidence review memo should begin with the phrase ", "__", "."],
    acceptedAnswers: ["foundational factual statements"],
    fillBlankMode: "token_bank",
    tokens: ["foundational factual statements", "procedural application points", "evidence review memo", "realistic institutional scenario"],
    outcomeKey: blueprint.fillBlankPlan.targetOutcomeKeys[0],
    bloomLevel: "Remember",
};

const invalidEssayQuestion = {
    questionType: "essay",
    generationVersion: ASSESSMENT_BLUEPRINT_VERSION,
    questionText: "Evaluate the claim using the evidence.",
    outcomeKey: blueprint.essayPlan.targetOutcomeKeys[0],
    bloomLevel: "Evaluate",
};

const legacyQuestion = {
    questionType: "multiple_choice",
    generationVersion: "assessment-blueprint-v2",
    questionText: "Legacy question",
};

for (const validQuestion of [
    validMultipleChoiceQuestion,
    validTrueFalseQuestion,
    validFillBlankQuestion,
]) {
    if (!isAssessmentV2Question(validQuestion, { blueprint })) {
        throw new Error(`Expected valid assessment-v4 question to pass active-assessment filter: ${validQuestion.questionType}`);
    }
}

if (isAssessmentV2Question(legacyQuestion, { blueprint })) {
    throw new Error("Expected legacy question versions to be excluded from assessment-v4.");
}

const essayIssues = getAssessmentQuestionMetadataIssues({
    question: invalidEssayQuestion,
    blueprint,
    questionType: "essay",
});
if (!essayIssues.includes("missing authenticContext")) {
    throw new Error("Expected authentic essays to require authenticContext when the blueprint demands it.");
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
    questions: [legacyQuestion, validMultipleChoiceQuestion],
});
if (legacyVisibleBeforeCutover.length !== 2) {
    throw new Error("Expected legacy questions to remain visible before blueprint cutover.");
}

const activeAfterCutover = filterQuestionsForActiveAssessment({
    topic: topicWithBlueprint,
    questions: [
        legacyQuestion,
        validMultipleChoiceQuestion,
        validTrueFalseQuestion,
        validFillBlankQuestion,
        invalidEssayQuestion,
    ],
});
if (activeAfterCutover.length !== 3) {
    throw new Error("Expected migrated topics to keep only valid assessment-v4 objective questions active.");
}

const topicsSource = await read("convex/topics.ts");
const examsSource = await read("convex/exams.ts");
const aiSource = await read("convex/ai.ts");

for (const requiredSnippet of [
    "const rawQuestions = await ctx.db",
    "questions: activeQuestions,",
    "usableMcqCount",
    "mcqTargetCount",
]) {
    if (!topicsSource.includes(requiredSnippet)) {
        throw new Error(`Expected topics.ts to include ${requiredSnippet}.`);
    }
}

if (!/const attemptDocument = \{[\s\S]*examFormat,[\s\S]*qualityTier: selectedQuality\.qualityTier,/m.test(examsSource)) {
    throw new Error("Expected new exam attempts to persist examFormat alongside premium quality metadata.");
}

if (!examsSource.includes("const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });")) {
    throw new Error("Expected exam start flow to use the active assessment question bank.");
}

if (!aiSource.includes("export const regenerateAssessmentQuestionBankInternal = internalAction({")) {
    throw new Error("Expected dedicated internal regeneration path for assessment-v2 question banks.");
}

if (!aiSource.includes("const generateQuestionBankForTopic = async")) {
    throw new Error("Expected assessment regeneration to route objective generation through the shared question bank orchestrator.");
}

console.log("assessment-cutover-regression.test.mjs passed");
