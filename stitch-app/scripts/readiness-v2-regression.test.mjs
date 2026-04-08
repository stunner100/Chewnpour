import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const read = async (relativePath) =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const topicsSource = await read("convex/topics.ts");
const schemaSource = await read("convex/schema.ts");

for (const requiredSchemaSnippet of [
  "objectiveReady: v.optional(v.boolean())",
  "essayReady: v.optional(v.boolean())",
  "usableTrueFalseCount: v.optional(v.number())",
  "usableFillInCount: v.optional(v.number())",
  "tier1Count: v.optional(v.number())",
  "tier2Count: v.optional(v.number())",
  "tier3Count: v.optional(v.number())",
  "difficultyDistribution: v.optional(v.object({",
  "bloomCoverage: v.optional(v.array(v.string()))",
  "canImprove: v.optional(v.boolean())",
  "improvementActions: v.optional(v.array(v.string()))",
]) {
  assert.ok(schemaSource.includes(requiredSchemaSnippet), `Expected schema.ts to include ${requiredSchemaSnippet}`);
}

for (const requiredTopicsSnippet of [
  "export const computeTopicExamReadinessFromQuestions = (",
  "const objectiveReady = usableObjectiveCount >= totalObjectiveTargetCount;",
  "const essayReady = usableEssayCount >= essayTargetCount;",
  "const tier1Count = usableObjectiveQuestions.filter(",
  "const difficultyDistribution = {",
  "const claimCoverage = totalSubClaimCount > 0",
  "const readinessScore = normalizeReadinessRatio(",
  "const improvementActions = [];",
  "&& tier1Sufficient",
  "&& difficultySpreadSufficient",
  "&& claimCoverageSufficient;",
  "usableObjectiveBreakdown: {",
  "canImprove: improvementActions.length > 0,",
  "buildTopicReadinessPatch(readiness, {",
]) {
  assert.ok(topicsSource.includes(requiredTopicsSnippet), `Expected topics.ts to include ${requiredTopicsSnippet}`);
}

console.log("readiness-v2-regression.test.mjs passed");
