import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, "convex", "ai.ts"), "utf8");
const generationSource = await fs.readFile(path.join(root, "convex", "lib", "groundedGeneration.ts"), "utf8");

if (!/getGroundedEvidencePackForTopic\([\s\S]*type:\s*"essay"/.test(aiSource)) {
    throw new Error("Expected essay generation to retrieve grounded evidence.");
}
if (!/applyGroundedAcceptance\(\{[\s\S]*type:\s*"essay"/.test(aiSource)) {
    throw new Error("Expected essay generation to enforce grounded acceptance.");
}
if (
    !aiSource.includes("createQuestionInternal, {")
    || !aiSource.includes('questionType: "essay"')
    || !aiSource.includes("citations: finalGrounding.validCitations")
    || !aiSource.includes("sourcePassageIds")
    || !aiSource.includes("groundingScore:")
    || !aiSource.includes("factualityStatus:")
    || !aiSource.includes("generationVersion: ASSESSMENT_QUESTION_GENERATION_VERSION")
    || !aiSource.includes("rubricPoints: rubricPoints.length > 0 ? rubricPoints : undefined")
) {
    throw new Error("Expected persisted essay questions to include citations and rubric grounding metadata.");
}
if (!/createQuestionInternal,\s*\{[\s\S]*questionType:\s*"essay"[\s\S]*learningObjective:[\s\S]*bloomLevel:[\s\S]*outcomeKey:[\s\S]*authenticContext:/.test(aiSource)) {
    throw new Error("Expected persisted essay questions to include assessment metadata.");
}
if (!/Use only outcome keys from assessmentBlueprint\.essayPlan\.targetOutcomeKeys\./.test(generationSource)) {
    throw new Error("Expected essay generation prompt to enforce assessment blueprint outcome keys.");
}
if (!/reason:\s*"INSUFFICIENT_EVIDENCE"/.test(aiSource)) {
    throw new Error("Expected essay generation to abstain on insufficient evidence.");
}

console.log("grounded-essay-factuality-regression.test.mjs passed");
