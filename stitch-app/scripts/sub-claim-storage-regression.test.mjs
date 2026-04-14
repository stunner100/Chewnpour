import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaSource = fs.readFileSync(path.join(root, "convex", "schema.ts"), "utf8");
const topicsSource = fs.readFileSync(path.join(root, "convex", "topics.ts"), "utf8");

const schemaExpectations = [
  "topicSubClaims: defineTable({",
  "distractorBank: defineTable({",
  "trueFalseTargetCount: v.optional(v.number())",
  "fillInTargetCount: v.optional(v.number())",
  "totalObjectiveTargetCount: v.optional(v.number())",
  "yieldConfidence: v.optional(v.string())",
  "yieldReasoning: v.optional(v.string())",
  "examIneligibleReason: v.optional(v.string())",
  "subClaimId: v.optional(v.id(\"topicSubClaims\"))",
  "cognitiveOperation: v.optional(v.string())",
  "groundingEvidence: v.optional(v.string())",
];

for (const snippet of schemaExpectations) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`Expected schema.ts to include snippet: ${snippet}`);
  }
}

const topicsExpectations = [
  "export const getSubClaimsByTopicInternal = internalQuery({",
  "export const getDistractorsByTopicInternal = internalQuery({",
  "export const updateTopicAssessmentMetadataInternal = internalMutation({",
  "export const replaceSubClaimsForTopicInternal = internalMutation({",
  "export const replaceDistractorsForTopicInternal = internalMutation({",
  "trueFalseTargetCount: 0,",
  "fillInTargetCount: 0,",
  "totalObjectiveTargetCount: EXAM_READY_MIN_MCQ_COUNT,",
  "subClaimId: args.subClaimId,",
  "cognitiveOperation: args.cognitiveOperation,",
  "groundingEvidence: args.groundingEvidence,",
];

for (const snippet of topicsExpectations) {
  if (!topicsSource.includes(snippet)) {
    throw new Error(`Expected topics.ts to include snippet: ${snippet}`);
  }
}

console.log("sub-claim-storage-regression.test.mjs passed");
