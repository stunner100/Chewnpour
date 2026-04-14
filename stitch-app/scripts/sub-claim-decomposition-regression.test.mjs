import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiSource = fs.readFileSync(path.join(root, "convex", "ai.ts"), "utf8");
const libSource = fs.readFileSync(path.join(root, "convex", "lib", "subClaimDecomposition.ts"), "utf8");

const aiExpectations = [
  "const ensureTopicSubClaimsForExamGeneration = async (args:",
  "internal.topics.getSubClaimsByTopicInternal",
  "SUB_CLAIM_DECOMPOSITION_SYSTEM_PROMPT",
  "buildSubClaimDecompositionPrompt({",
  "internal.topics.replaceSubClaimsForTopicInternal",
  "internal.topics.updateTopicAssessmentMetadataInternal",
  "await ensureTopicSubClaimsForExamGeneration({",
  "parseJsonFromResponse(response, \"sub_claim_decomposition\")",
];

for (const snippet of aiExpectations) {
  if (!aiSource.includes(snippet)) {
    throw new Error(`Expected ai.ts to include snippet: ${snippet}`);
  }
}

const libExpectations = [
  "export const SUB_CLAIM_TYPES = [",
  "export const COGNITIVE_OPERATIONS = [",
  "export const SUB_CLAIM_DECOMPOSITION_SYSTEM_PROMPT =",
  "export const buildSubClaimDecompositionPrompt = (args:",
  "export const normalizeSubClaimResponse = (payload: any, evidence: RetrievedEvidence[]): NormalizedSubClaim[] => {",
  "questionYieldEstimate",
];

for (const snippet of libExpectations) {
  if (!libSource.includes(snippet)) {
    throw new Error(`Expected subClaimDecomposition.ts to include snippet: ${snippet}`);
  }
}

console.log("sub-claim-decomposition-regression.test.mjs passed");
