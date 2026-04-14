import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'convex', 'examPreparations.ts'), 'utf8');

for (const snippet of [
  'questionSetVersion: v.optional(v.number())',
  'assessmentVersion: v.optional(v.string())',
  'const latestQuestionSetVersion = resolveTopicQuestionSetVersion(topicSnapshot);',
  'const latestAssessmentVersion = resolveExamAssessmentVersion(',
  'if (!preparation.attemptId && (preparation.status === "queued" || preparation.status === "preparing")) {',
  'status: "queued"',
  'stage: "queued"',
  'questionSetVersion: latestQuestionSetVersion',
  'assessmentVersion: latestAssessmentVersion',
]) {
  if (!source.includes(snippet)) {
    throw new Error(`Expected examPreparations.ts to include "${snippet}" for stale-preparation rebasing.`);
  }
}

if (!source.includes('reasonCode: "STALE_PREPARATION"')) {
  throw new Error('Expected stale preparations with saved attempts to remain explicitly marked as STALE_PREPARATION.');
}

console.log('exam-preparation-stale-rebase-regression.test.mjs passed');
