import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, "convex", "ai.ts"), "utf8");

if (!/getGroundedEvidencePackForTopic\([\s\S]*type:\s*"essay"/.test(aiSource)) {
    throw new Error("Expected essay generation to retrieve grounded evidence.");
}
if (!/applyGroundedAcceptance\(\{[\s\S]*type:\s*"essay"/.test(aiSource)) {
    throw new Error("Expected essay generation to enforce grounded acceptance.");
}
if (!/createQuestionInternal,\s*\{[\s\S]*questionType:\s*"essay"[\s\S]*citations,[\s\S]*sourcePassageIds,[\s\S]*groundingScore:[\s\S]*factualityStatus:[\s\S]*rubricPoints:/.test(aiSource)) {
    throw new Error("Expected persisted essay questions to include citations and rubric grounding metadata.");
}
if (!/reason:\s*"INSUFFICIENT_EVIDENCE"/.test(aiSource)) {
    throw new Error("Expected essay generation to abstain on insufficient evidence.");
}

console.log("grounded-essay-factuality-regression.test.mjs passed");
