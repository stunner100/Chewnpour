import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiPath = path.join(root, "convex", "ai.ts");
const policyPath = path.join(root, "convex", "lib", "assessmentPolicy.js");
const generationPath = path.join(root, "convex", "lib", "groundedGeneration.ts");

const [aiSource, policySource, generationSource] = await Promise.all([
  fs.readFile(aiPath, "utf8"),
  fs.readFile(policyPath, "utf8"),
  fs.readFile(generationPath, "utf8"),
]);

for (const requiredPattern of [
  /const ensureGroundedEvidenceForTopic = async/,
  /const computeQuestionCoverageGaps = \(/,
  /const generateMcqQuestionGapBatch = async/,
  /const generateEssayQuestionGapBatch = async/,
  /const acceptAndPersistQuestionCandidates = async/,
]) {
  if (!requiredPattern.test(aiSource)) {
    throw new Error("Expected ai.ts to expose the Phase 3 gap-driven generation helpers.");
  }
}

if (!/coveragePolicy\.needsGeneration/.test(aiSource)) {
  throw new Error("Expected ai.ts to continue generation based on coverage gaps, not only raw count.");
}

if (!/generateMcqQuestionGapBatch\(/.test(aiSource) || !/generateEssayQuestionGapBatch\(/.test(aiSource)) {
  throw new Error("Expected both MCQ and essay generation to route through gap-targeted batch helpers.");
}

for (const exportPattern of [
  /export const computeQuestionCoverageGaps =/,
  /export const selectCoverageGapTargets =/,
  /export const resolveAssessmentGenerationPolicy =/,
]) {
  if (!exportPattern.test(policySource)) {
    throw new Error("Expected assessmentPolicy.js to export the shared coverage-gap policy helpers.");
  }
}

if (!/coverageTargets\?: AssessmentCoverageTarget\[]/.test(generationSource)) {
  throw new Error("Expected groundedGeneration prompts to accept explicit coverage target guidance.");
}

if (!/Coverage gaps to prioritize first:/.test(generationSource)) {
  throw new Error("Expected groundedGeneration prompts to include a coverage-gap instruction block.");
}

console.log("exam-gap-generation-regression.test.mjs passed");
