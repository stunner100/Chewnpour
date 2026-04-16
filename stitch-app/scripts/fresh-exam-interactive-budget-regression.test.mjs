import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');

const aiSource = await fs.readFile(aiPath, 'utf8');

const requiredSnippets = [
  'const FRESH_EXAM_INTERACTIVE_BUDGET_MS = (() => {',
  'const buildFreshExamTimedOutError = () => new ConvexError({',
  'const deadlineMs = Date.now() + FRESH_EXAM_INTERACTIVE_BUDGET_MS;',
  'ensureFreshExamDeadlineRemaining(deadlineMs);',
  'deadlineMs,',
  'repairTimeoutMs: resolveFreshExamStepTimeoutMs({',
];

for (const snippet of requiredSnippets) {
  if (!aiSource.includes(snippet)) {
    throw new Error(`Expected convex/ai.ts to include "${snippet}" for fresh exam interactive budgeting.`);
  }
}

if (!/parseFreshExamQuestionsWithRepair\([\s\S]*deadlineMs,/m.test(aiSource)) {
  throw new Error('Expected fresh exam JSON repair to receive the shared deadline.');
}

if (!/ensureAssessmentBlueprintForTopic\([\s\S]*deadlineMs,/m.test(aiSource)) {
  throw new Error('Expected assessment blueprint generation to share the fresh exam deadline.');
}

console.log('fresh-exam-interactive-budget-regression.test.mjs passed');
