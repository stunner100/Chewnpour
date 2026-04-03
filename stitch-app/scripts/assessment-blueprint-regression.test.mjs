import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = async (relativePath) =>
    fs.readFile(path.join(root, relativePath), "utf8");

const aiSource = await read("convex/ai.ts");
const generationSource = await read("convex/lib/groundedGeneration.ts");
const verifierSource = await read("convex/lib/groundedVerifier.ts");
const pipelineSource = await read("convex/lib/groundedContentPipeline.ts");
const topicsSource = await read("convex/topics.ts");
const examsSource = await read("convex/exams.ts");
const schemaSource = await read("convex/schema.ts");

if (!generationSource.includes("Create an assessment blueprint for objective and essay generation using Bloom's taxonomy, constructive alignment, and authentic assessment.")) {
    throw new Error("Expected grounded assessment blueprint prompt to reference objective and essay generation.");
}

for (const requiredPrompt of [
    "Each outcome must include: key, objective, bloomLevel, evidenceFocus, cognitiveTask, difficultyBand.",
    "objectivePlan.targetDifficultyDistribution must sum to 1 across easy, medium, hard.",
    "objectivePlan.minDistinctOutcomeCount should be at least 3 when the evidence supports it.",
    "essayPlan.minDistinctOutcomeCount should be at least 2 when the evidence supports it.",
    "essayPlan.minDistinctScenarioFrameCount should be at least 2 when the evidence supports it.",
    "multipleChoicePlan.targetOutcomeKeys",
    "trueFalsePlan.targetOutcomeKeys",
    "fillBlankPlan.targetOutcomeKeys",
    "Use only outcome keys from assessmentBlueprint.multipleChoicePlan.targetOutcomeKeys.",
    "Use only outcome keys from assessmentBlueprint.trueFalsePlan.targetOutcomeKeys.",
    "Use only outcome keys from assessmentBlueprint.fillBlankPlan.targetOutcomeKeys.",
    "All objective items must stay grounded in the topic material but be framed as application, interpretation, diagnosis, comparison, or scenario evaluation, not direct recall or definition lookup.",
    "multiple_choice outcomes should support only: Apply, Analyze.",
    "true_false outcomes should support only: Apply.",
    "fill_blank outcomes should support only: Apply.",
    "Every question must be framed as application, interpretation, diagnosis, comparison, or scenario evaluation, not direct recall or definition lookup.",
    "Use exactly 2 options: True and False.",
    "If False is correct, the statement must be directly contradicted by the evidence, not vaguely unsupported.",
    "templateParts must contain exactly one \"__\" entry.",
    "acceptedAnswers must contain the canonical correct answer first, then any exact aliases supported by the evidence.",
]) {
    if (!generationSource.includes(requiredPrompt)) {
        throw new Error(`Expected grounded generation contract to include: ${requiredPrompt}`);
    }
}

for (const requiredSnippet of [
    '"easy": 0.1',
    '"medium": 0.3',
    '"hard": 0.6',
    '"questionType": "multiple_choice"',
    '"questionType": "true_false"',
    '"questionType": "fill_blank"',
    '"bloomLevel": "Apply|Analyze"',
    '"bloomLevel": "Apply"',
    '"outcomeKey": "outcome-1"',
    '"cognitiveTask": "compare"',
    '"difficultyBand": "hard"',
]) {
    if (!generationSource.includes(requiredSnippet)) {
        throw new Error(`Expected grounded generation schema example to include ${requiredSnippet}.`);
    }
}

if (!generationSource.includes('fillBlankMode must be either "token_bank" or "free_text".')) {
    throw new Error('Expected grounded fill-blank contract to require token_bank or free_text mode.');
}

if (!generationSource.includes("If assessmentBlueprint.essayPlan.authenticScenarioRequired is true, prefer a realistic or professional scenario framing and include authenticContext.")) {
    throw new Error("Expected grounded essay prompt to require authentic scenario framing when the blueprint demands it.");
}

if (!aiSource.includes("const ASSESSMENT_QUESTION_GENERATION_VERSION = ASSESSMENT_BLUEPRINT_VERSION;")) {
    throw new Error("Expected assessment-blueprint-v3 generation version constant in ai.ts.");
}

for (const requiredAiSnippet of [
    "const ensureAssessmentBlueprintForTopic = async",
    "buildGroundedAssessmentBlueprintPrompt({",
    "const generateMcqQuestionGapBatch = async",
    "const generateTrueFalseQuestionGapBatch = async",
    "const generateFillBlankQuestionGapBatch = async",
    "const applyPremiumQualityPass = async",
    "questionType: QUESTION_TYPE_TRUE_FALSE,",
    "questionType: QUESTION_TYPE_FILL_BLANK,",
]) {
    if (!aiSource.includes(requiredAiSnippet)) {
        throw new Error(`Expected ai.ts to include ${requiredAiSnippet}.`);
    }
}

if (!/const questionPayload: Record<string, any> = \{[\s\S]*questionType:\s*normalizedQuestionType,[\s\S]*generationVersion:\s*ASSESSMENT_QUESTION_GENERATION_VERSION[\s\S]*learningObjective:[\s\S]*bloomLevel:[\s\S]*outcomeKey:[\s\S]*qualityTier:/s.test(aiSource)) {
    throw new Error("Expected persisted objective questions to include premium assessment metadata.");
}

if (!/if \(normalizedQuestionType === QUESTION_TYPE_FILL_BLANK\) \{[\s\S]*questionPayload\.templateParts = Array\.isArray\(questionRecord\.templateParts\)[\s\S]*questionPayload\.acceptedAnswers = Array\.isArray\(questionRecord\.acceptedAnswers\)[\s\S]*questionPayload\.fillBlankMode = String\(/s.test(aiSource)) {
    throw new Error("Expected persisted fill_blank questions to include templateParts, acceptedAnswers, and fillBlankMode.");
}

if (
    !verifierSource.includes("QUESTION_TYPE_TRUE_FALSE")
    || !verifierSource.includes("QUESTION_TYPE_FILL_BLANK")
    || !verifierSource.includes("invalid true_false structure")
    || !verifierSource.includes("invalid fill_blank structure")
) {
    throw new Error("Expected deterministic grounded verifier to validate true_false and fill_blank question types.");
}

if (!pipelineSource.includes("assessmentBlueprint?: AssessmentBlueprint | null;")) {
    throw new Error("Expected grounded content pipeline to accept optional assessmentBlueprint.");
}

if (!topicsSource.includes("saveAssessmentBlueprintInternal = internalMutation")) {
    throw new Error("Expected topic blueprint persistence mutation.");
}

if (!topicsSource.includes("Assessment metadata invalid")) {
    throw new Error("Expected question persistence to hard-fail invalid assessment metadata.");
}

if (!/acceptedAnswers\.some\(\(aa: string\) => String\(aa\)\.trim\(\)\.toLowerCase\(\) === selectedNorm\)/.test(examsSource)) {
    throw new Error("Expected objective submission to grade fill blanks against acceptedAnswers.");
}

if (!schemaSource.includes("objectiveTargetCount: v.optional(v.number())")) {
    throw new Error("Expected topics schema to persist objectiveTargetCount.");
}

for (const requiredField of [
    "usableObjectiveCount: v.optional(v.number())",
    "usableObjectiveBreakdown: v.optional(v.object({",
    "targetBloomLevels: v.array(v.string())",
    "templateParts: v.optional(v.array(v.string()))",
    "tokens: v.optional(v.array(v.string()))",
    "acceptedAnswers: v.optional(v.array(v.string()))",
    "fillBlankMode: v.optional(v.string())",
    "questionType: v.string(), // 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'",
    "qualityTier: v.optional(v.string())",
    "rigorScore: v.optional(v.number())",
    "clarityScore: v.optional(v.number())",
    "diversityCluster: v.optional(v.string())",
    "distractorScore: v.optional(v.number())",
]) {
    if (!schemaSource.includes(requiredField)) {
        throw new Error(`Expected schema to include ${requiredField}.`);
    }
}

console.log("assessment-blueprint-regression.test.mjs passed");
