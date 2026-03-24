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
    "multipleChoicePlan.targetOutcomeKeys",
    "trueFalsePlan.targetOutcomeKeys",
    "fillBlankPlan.targetOutcomeKeys",
    "Use only outcome keys from assessmentBlueprint.multipleChoicePlan.targetOutcomeKeys.",
    "Use only outcome keys from assessmentBlueprint.trueFalsePlan.targetOutcomeKeys.",
    "Use only outcome keys from assessmentBlueprint.fillBlankPlan.targetOutcomeKeys.",
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
    '"questionType": "multiple_choice"',
    '"questionType": "true_false"',
    '"questionType": "fill_blank"',
    '"bloomLevel": "Remember|Understand|Apply|Analyze"',
    '"outcomeKey": "outcome-1"',
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
    throw new Error("Expected assessment-blueprint-v2 generation version constant in ai.ts.");
}

for (const requiredAiSnippet of [
    "const ensureAssessmentBlueprintForTopic = async",
    "buildGroundedAssessmentBlueprintPrompt({",
    "const generateObjectiveSubtypeQuestionBankForTopic = async",
    "const generateObjectiveQuestionBankForTopic = async",
    "questionType: QUESTION_TYPE_TRUE_FALSE,",
    "questionType: QUESTION_TYPE_FILL_BLANK,",
    "export const gradeFillBlankAnswer = internalAction({",
]) {
    if (!aiSource.includes(requiredAiSnippet)) {
        throw new Error(`Expected ai.ts to include ${requiredAiSnippet}.`);
    }
}

if (!/createQuestionInternal,\s*\{[\s\S]*questionType:\s*"multiple_choice"[\s\S]*generationVersion:\s*ASSESSMENT_QUESTION_GENERATION_VERSION[\s\S]*learningObjective:[\s\S]*bloomLevel:[\s\S]*outcomeKey:/s.test(aiSource)) {
    throw new Error("Expected persisted objective multiple-choice questions to include assessment metadata.");
}

if (!/templateParts:\s*Array\.isArray\(savePayload\.templateParts\)[\s\S]*acceptedAnswers:\s*Array\.isArray\(savePayload\.acceptedAnswers\)[\s\S]*fillBlankMode:/s.test(aiSource)) {
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

if (!examsSource.includes("ctx.runAction(internal.ai.gradeFillBlankAnswer")) {
    throw new Error("Expected objective submission to use AI-assisted grading for unmatched free-text blanks.");
}

if (!schemaSource.includes("objectiveTargetCount: v.optional(v.number())")) {
    throw new Error("Expected topics schema to persist objectiveTargetCount.");
}

for (const requiredField of [
    "usableObjectiveCount: v.optional(v.number())",
    "usableObjectiveBreakdown: v.optional(v.object({",
    "templateParts: v.optional(v.array(v.string()))",
    "tokens: v.optional(v.array(v.string()))",
    "acceptedAnswers: v.optional(v.array(v.string()))",
    "fillBlankMode: v.optional(v.string())",
    "questionType: v.string(), // 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'",
]) {
    if (!schemaSource.includes(requiredField)) {
        throw new Error(`Expected schema to include ${requiredField}.`);
    }
}

console.log("assessment-blueprint-regression.test.mjs passed");
