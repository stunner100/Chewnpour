import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const fillInPath = path.join(root, 'src', 'pages', 'FillInExercise.jsx');

const [aiSource, fillInSource] = await Promise.all([
  fs.readFile(aiPath, 'utf8'),
  fs.readFile(fillInPath, 'utf8'),
]);

if (!/excludeSentences: v\.optional\(v\.array\(v\.string\(\)\)\),/.test(aiSource)) {
  throw new Error('Expected generateFillInBatch to accept excludeSentences.');
}

if (!/\.\.\.\(Array\.isArray\(args\.excludeSentences\) \? args\.excludeSentences : \[\]\),/.test(aiSource)) {
  throw new Error('Expected fill-in duplicate avoidance to include the current set sentences.');
}

if (!/const shuffleQuestions = \(questions\) => \{/.test(fillInSource)) {
  throw new Error('Expected FillInExercise to keep a reshuffle fallback for repeated sets.');
}

if (!/const response = await generateFillInBatch\(\{ topicId, excludeSentences \}\);/.test(fillInSource)) {
  throw new Error('Expected New Set to request a non-overlapping fill-in batch.');
}

if (!/loadExercise\(\{\s*excludeSentences: Array\.isArray\(questions\)/.test(fillInSource)) {
  throw new Error('Expected the New Set CTA to pass the current question sentences as exclusions.');
}

console.log('fill-in-new-set-regression.test.mjs passed');
