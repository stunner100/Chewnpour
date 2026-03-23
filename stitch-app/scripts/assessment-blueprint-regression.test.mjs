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
const schemaSource = await read("convex/schema.ts");

if (!generationSource.includes("Create an assessment blueprint for MCQ and essay generation using Bloom's taxonomy, constructive alignment, and authentic assessment.")) {
    throw new Error("Expected grounded assessment blueprint prompt to reference the assessment-design framework.");
}

if (!generationSource.includes("Use only outcome keys from assessmentBlueprint.mcqPlan.targetOutcomeKeys.")) {
    throw new Error("Expected grounded MCQ prompt to require blueprint outcome keys.");
}

if (!generationSource.includes('"bloomLevel": "Remember|Understand|Apply|Analyze"')) {
    throw new Error("Expected grounded MCQ contract to require allowed Bloom levels.");
}

if (!generationSource.includes('"outcomeKey": "outcome-1"')) {
    throw new Error("Expected grounded generation contracts to require outcomeKey.");
}

if (!generationSource.includes("If assessmentBlueprint.essayPlan.authenticScenarioRequired is true, prefer a realistic or professional scenario framing and include authenticContext.")) {
    throw new Error("Expected grounded essay prompt to require authentic scenario framing when the blueprint demands it.");
}

if (!aiSource.includes("const ASSESSMENT_QUESTION_GENERATION_VERSION = ASSESSMENT_BLUEPRINT_VERSION;")) {
    throw new Error("Expected assessment-v1 generation version constant in ai.ts.");
}

if (!aiSource.includes("const ensureAssessmentBlueprintForTopic = async")) {
    throw new Error("Expected blueprint generation helper in ai.ts.");
}

if (!aiSource.includes("buildGroundedAssessmentBlueprintPrompt({")) {
    throw new Error("Expected ai.ts to build a grounded assessment blueprint before question generation.");
}

if (!/applyGroundedAcceptance\(\{[\s\S]*type:\s*"mcq"[\s\S]*assessmentBlueprint,/.test(aiSource)) {
    throw new Error("Expected MCQ grounded acceptance to receive assessmentBlueprint.");
}

if (!/applyGroundedAcceptance\(\{[\s\S]*type:\s*"essay"[\s\S]*assessmentBlueprint,/.test(aiSource)) {
    throw new Error("Expected essay grounded acceptance to receive assessmentBlueprint.");
}

if (!/createQuestionInternal,\s*\{[\s\S]*questionType:\s*"multiple_choice"[\s\S]*generationVersion:\s*ASSESSMENT_QUESTION_GENERATION_VERSION[\s\S]*learningObjective:[\s\S]*bloomLevel:[\s\S]*outcomeKey:[\s\S]*authenticContext:/.test(aiSource)) {
    throw new Error("Expected persisted MCQs to include assessment metadata fields.");
}

if (!/createQuestionInternal,\s*\{[\s\S]*questionType:\s*"essay"[\s\S]*generationVersion:\s*ASSESSMENT_QUESTION_GENERATION_VERSION[\s\S]*learningObjective:[\s\S]*bloomLevel:[\s\S]*outcomeKey:[\s\S]*authenticContext:[\s\S]*rubricPoints:/.test(aiSource)) {
    throw new Error("Expected persisted essays to include assessment metadata fields.");
}

if (!verifierSource.includes("getAssessmentQuestionMetadataIssues")) {
    throw new Error("Expected deterministic grounded verifier to validate assessment metadata.");
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

if (!schemaSource.includes("assessmentBlueprint: v.optional(v.object({")) {
    throw new Error("Expected topics schema to persist assessmentBlueprint.");
}

for (const requiredField of [
    "bloomLevel: v.optional(v.string())",
    "outcomeKey: v.optional(v.string())",
    "authenticContext: v.optional(v.string())",
]) {
    if (!schemaSource.includes(requiredField)) {
        throw new Error(`Expected questions schema to include ${requiredField}.`);
    }
}

console.log("assessment-blueprint-regression.test.mjs passed");
