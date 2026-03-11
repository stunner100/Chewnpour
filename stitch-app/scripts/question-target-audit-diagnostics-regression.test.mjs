import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = path.join(root, "convex", "schema.ts");
const groundedPath = path.join(root, "convex", "grounded.ts");

const [schemaSource, groundedSource] = await Promise.all([
  fs.readFile(schemaPath, "utf8"),
  fs.readFile(groundedPath, "utf8"),
]);

for (const expectedPattern of [
  "questionTargetAuditRuns: defineTable({",
  'mcqSummary: v.object({',
  'essaySummary: v.object({',
  'rebasedTopics: v.array(v.object({',
  '}).index("by_finishedAt", ["finishedAt"])',
]) {
  if (!schemaSource.includes(expectedPattern)) {
    throw new Error(`Expected schema.ts to include "${expectedPattern}" for persisted audit diagnostics.`);
  }
}

for (const expectedPattern of [
  "export const insertQuestionTargetAuditRunInternal = internalMutation({",
  'questionTargetAuditRuns',
  "export const getLatestQuestionTargetAuditDiagnostics = internalQuery({",
  'withIndex("by_finishedAt")',
  "totalRebasedTopics",
]) {
  if (!groundedSource.includes(expectedPattern)) {
    throw new Error(`Expected grounded.ts to include "${expectedPattern}" for latest audit diagnostics.`);
  }
}

console.log("question-target-audit-diagnostics-regression.test.mjs passed");
