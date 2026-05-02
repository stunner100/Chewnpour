import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/exams.ts", import.meta.url), "utf8");

const startExamMatch = source.match(/export const startExamAttempt = action\(\{[\s\S]*?\n\}\);/);

if (!startExamMatch) {
  throw new Error("Expected startExamAttempt action to exist.");
}

const startExamSource = startExamMatch[0];
const reuseIndex = startExamSource.indexOf("ensurePreparedExamAttemptInternal");
const generateIndex = startExamSource.indexOf("generateFreshExamSnapshotInternal");

if (reuseIndex === -1) {
  throw new Error("Expected startExamAttempt to check for reusable fresh attempts before generation.");
}

if (generateIndex === -1) {
  throw new Error("Expected startExamAttempt to keep fresh generation when no attempt is reusable.");
}

if (reuseIndex > generateIndex) {
  throw new Error("Reusable fresh attempts must be checked before expensive exam generation.");
}

if (!/reusedAttempt:\s*true/.test(startExamSource)) {
  throw new Error("Expected reused attempts to be returned without regenerating questions.");
}

console.log("exam-start-reuses-fresh-attempt-regression.test.mjs passed");
