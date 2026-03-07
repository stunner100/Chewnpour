import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicsPath = path.join(root, 'convex', 'topics.ts');
const topicsSource = await fs.readFile(topicsPath, 'utf8');

if (!topicsSource.includes('const computedReadiness = computeTopicExamReadinessFromQuestions(dedupedQuestions, {')) {
  throw new Error('Expected getTopicWithQuestions to compute readiness from live questions and the stored MCQ target.');
}

for (const expectedLine of [
  'mcqTargetCount: computedReadiness.mcqTargetCount,',
  'usableMcqCount: computedReadiness.usableMcqCount,',
  'usableEssayCount: computedReadiness.usableEssayCount,',
  'examReady: computedReadiness.examReady,',
]) {
  if (!topicsSource.includes(expectedLine)) {
    throw new Error(`Expected topics.ts to derive "${expectedLine}" from computed readiness.`);
  }
}

for (const stalePattern of [
  'isFiniteNumber(topic.usableMcqCount)',
  'isFiniteNumber(topic.usableEssayCount)',
  'typeof topic.examReady === "boolean"',
]) {
  if (topicsSource.includes(stalePattern)) {
    throw new Error(`Regression detected: stale readiness fallback "${stalePattern}" should not be used.`);
  }
}

console.log('topic-live-readiness-regression.test.mjs passed');
