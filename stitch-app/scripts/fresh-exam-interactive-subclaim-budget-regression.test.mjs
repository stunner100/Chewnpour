import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/ai.ts", import.meta.url), "utf8");

if (!/skipSubClaimGeneration\?:\s*boolean/.test(source)) {
  throw new Error("Expected assessment blueprint generation to support skipping sub-claim LLM generation.");
}

if (!/skipSubClaimGeneration:\s*true/.test(source)) {
  throw new Error("Expected fresh exam startup to skip new sub-claim LLM generation in the interactive path.");
}

if (!/subClaims\.length === 0 && !args\.skipSubClaimGeneration/.test(source)) {
  throw new Error("Expected sub-claim generation to run only when the skip flag is not enabled.");
}

if (!/FRESH_CONTEXT_OBJECTIVE_INTERACTIVE_MAX_COUNT\s*=\s*5/.test(source)) {
  throw new Error("Expected interactive objective exams to use a bounded question count.");
}

if (!/forceQuestionType:\s*"multiple_choice"/.test(source)) {
  throw new Error("Expected interactive objective exams to generate MCQ-only questions directly.");
}

if (!/authoringAttempts\s*=\s*examFormat === "essay" \? 2 : 1/.test(source)) {
  throw new Error("Expected objective exam startup to avoid multiple expensive authoring attempts.");
}

console.log("fresh-exam-interactive-subclaim-budget-regression.test.mjs passed");
