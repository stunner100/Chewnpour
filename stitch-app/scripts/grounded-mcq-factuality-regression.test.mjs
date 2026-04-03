import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, "convex", "ai.ts"), "utf8");
const generationSource = await fs.readFile(path.join(root, "convex", "lib", "groundedGeneration.ts"), "utf8");
const verifierSource = await fs.readFile(path.join(root, "convex", "lib", "groundedVerifier.ts"), "utf8");
const groundedSource = await fs.readFile(path.join(root, "convex", "grounded.ts"), "utf8");
const topicsSource = await fs.readFile(path.join(root, "convex", "topics.ts"), "utf8");

if (!/type:\s*"mcq"/.test(aiSource) || !/getGroundedEvidencePackForTopic\(/.test(aiSource)) {
    throw new Error("Expected MCQ generation to load grounded evidence.");
}
if (!/applyGroundedAcceptance\(\{[\s\S]*type:\s*"mcq"/.test(aiSource)) {
    throw new Error("Expected MCQ generation to use grounded acceptance gates.");
}
if (!/applyGroundedAcceptance\(\{[\s\S]*repairCandidate:/.test(aiSource)) {
    throw new Error("Expected MCQ generation to repair unsupported grounded candidates before rejection.");
}
if (!/const questionPayload: Record<string, any> = \{[\s\S]*questionType:\s*normalizedQuestionType,[\s\S]*citations,[\s\S]*sourcePassageIds,[\s\S]*groundingScore:[\s\S]*factualityStatus:[\s\S]*generationVersion:/s.test(aiSource)) {
    throw new Error("Expected persisted MCQs to include grounding metadata and citations.");
}
if (!/const questionPayload: Record<string, any> = \{[\s\S]*learningObjective:[\s\S]*bloomLevel:[\s\S]*outcomeKey:/s.test(aiSource)) {
    throw new Error("Expected persisted MCQs to include assessment metadata.");
}
if (!/const finalGrounding = runDeterministicGroundingCheck\(\{[\s\S]*type:\s*resolveGroundedContentType\(normalizedQuestionType\)/.test(aiSource)) {
    throw new Error("Expected MCQ persistence to revalidate final options against grounded evidence.");
}
if (!/reason:\s*"INSUFFICIENT_EVIDENCE"/.test(aiSource)) {
    throw new Error("Expected MCQ pipeline to abstain when evidence is insufficient.");
}
if (!/The marked correct option must be directly supported by the cited evidence\./.test(generationSource)) {
    throw new Error("Expected grounded MCQ prompt to require evidence-backed correct options.");
}
if (!/Use only outcome keys from assessmentBlueprint\.multipleChoicePlan\.targetOutcomeKeys\./.test(generationSource)) {
    throw new Error("Expected grounded MCQ prompt to enforce assessment blueprint outcome keys.");
}
if (!/Repair the objective multiple-choice question below so it is strictly grounded in the evidence passages\./.test(generationSource)) {
    throw new Error("Expected grounded MCQ repair prompt to exist for unsupported answer recovery.");
}
if (!/correct option unsupported by cited evidence/.test(verifierSource) || !/validateObjectiveSupport/.test(verifierSource)) {
    throw new Error("Expected deterministic grounding checks to reject unsupported MCQ answers.");
}
if (!/export const remediateStoredMcqGroundingMismatches = internalAction/.test(groundedSource)) {
    throw new Error("Expected grounded remediation action to exist for stored MCQ mismatches.");
}
if (!/export const deleteMcqQuestionsByTopicInternal = internalMutation/.test(topicsSource)) {
    throw new Error("Expected targeted MCQ-only deletion mutation for remediation.");
}

console.log("grounded-mcq-factuality-regression.test.mjs passed");
