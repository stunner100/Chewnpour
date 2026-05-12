import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');

const forbiddenSnippets = [
  'buildDeterministicFreshObjectiveQuestions',
  'buildDeterministicFreshEssayQuestions',
  'buildDeterministicFreshExamFallbackSnapshot',
  'isFreshExamAuthoringFallbackEligibleError',
  'fresh-deterministic-objective',
  'fresh-deterministic-essay',
  'deterministic-fresh-exam-fallback',
  'last_resort_grounded_fallback',
  'quality_gate_bypassed_for_grounded_fallback',
  'Which statement is directly supported by Evidence',
  'Which statement is directly supported by the cited source',
  'cannot be assessed from the lesson material',
  'The cited evidence is unrelated to the current lesson topic.',
  'The cited evidence gives no useful information for answering the question.',
  'The source says this topic has no practical study value.',
  'The source says the cited idea should be ignored during revision.',
  'The source says the cited evidence is unrelated to learning.',
];

for (const snippet of forbiddenSnippets) {
  if (aiSource.includes(snippet)) {
    throw new Error(`Fallback exam question pattern must not be present: ${snippet}`);
  }
}

if (!/buildSyntheticEvidenceFromTopic/.test(aiSource)) {
  throw new Error('Expected fresh exams to keep using topic context when grounded retrieval has no usable hits.');
}

if (!/authoring_failed_without_deterministic_fallback/.test(aiSource)) {
  throw new Error('Expected authoring failures to be logged without serving fallback questions.');
}

console.log('no-fallback-exam-questions-regression.test.mjs passed');
