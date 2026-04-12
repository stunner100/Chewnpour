import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const examsSource = await fs.readFile(path.join(root, 'convex', 'exams.ts'), 'utf8');
const topicsSource = await fs.readFile(path.join(root, 'convex', 'topics.ts'), 'utf8');
const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');

if (/generateQuestionsForTopicOnDemandInternal/.test(examsSource) || /generateEssayQuestionsForTopicOnDemandInternal/.test(examsSource)) {
  throw new Error('Expected exams.ts to stop depending on on-demand question-bank generation.');
}

if (!/generateFreshExamSnapshotInternal/.test(examsSource)) {
  throw new Error('Expected exams.ts to use the fresh-context generation action.');
}

if (!/const validateFreshObjectiveExamSet = \(args: \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to validate fresh objective exam sets synchronously.');
}

if (!/const validateFreshEssayExamSet = \(args: \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to validate fresh essay exam sets synchronously.');
}

if (!/const buildFreshExamSnapshot = \(args: \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to persist snapshot-ready exam payloads.');
}

if (!/runDeterministicGroundingCheck\(\{\s*type:\s*"mcq"/.test(aiSource)) {
  throw new Error('Expected fresh objective validation to keep deterministic grounding checks.');
}

if (!/runDeterministicGroundingCheck\(\{\s*type:\s*"essay"/.test(aiSource)) {
  throw new Error('Expected fresh essay validation to keep deterministic grounding checks.');
}

if (!/const computeTopicExamReadinessFromQuestions = \(/.test(topicsSource)) {
  throw new Error('Expected topics.ts to keep centralized exam readiness computation for non-exam surfaces.');
}

console.log('exam-question-quality-gate-regression.test.mjs passed');
