import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const source = await fs.readFile(aiPath, 'utf8');

if (!/const FRESH_CONTEXT_INTERACTIVE_BUDGET_MS = Math\.max\(/.test(source)) {
  throw new Error('Expected ai.ts to define an interactive fresh-exam budget.');
}

if (!/const getFreshExamRemainingMs = \(deadlineMs: number, reserveMs = 0\)/.test(source)) {
  throw new Error('Expected ai.ts to expose a fresh-exam remaining-budget helper.');
}

if (!/interactiveDeadlineMs = Date\.now\(\) \+ FRESH_CONTEXT_INTERACTIVE_BUDGET_MS/.test(source)) {
  throw new Error('Expected generateFreshExamSnapshotInternal to set an interactive deadline.');
}

if (!/isFreshExamDeadlineExceeded\(interactiveDeadlineMs, 5000\)/.test(source)) {
  throw new Error('Expected fresh exam authoring to stop when the interactive deadline is exhausted.');
}

if (!/getFreshExamRemainingMs\(interactiveDeadlineMs, 3000\)/.test(source)) {
  throw new Error('Expected fresh exam authoring timeouts to clamp to the remaining interactive budget.');
}

if (/buildDeterministicFreshExamFallbackSnapshot\(\{[\s\S]*reason: "authoring-timeout"/.test(source)) {
  throw new Error('Expected authoring timeout recovery not to return deterministic fallback questions.');
}

if (!/authoring_failed_without_deterministic_fallback/.test(source)) {
  throw new Error('Expected exhausted fresh exam authoring to fail cleanly instead of serving fallback questions.');
}

console.log('exam-interactive-budget-regression.test.mjs passed');
