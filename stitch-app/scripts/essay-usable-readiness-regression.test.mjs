import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/const existingUsableEssay = existingEssay\.filter\([\s\S]*isUsableExamQuestion\(question, \{ allowEssay: true \}\)/s.test(aiSource)) {
  throw new Error('Expected essay generation to derive readiness from usable essay questions only.');
}

if (!/if \(existingUsableEssayCount >= targetCount\)/.test(aiSource)) {
  throw new Error('Expected early-return readiness check to use usable essay count against the derived essay target.');
}

if (!/normalizedCorrectAnswer\.length < 6/.test(aiSource)) {
  throw new Error('Expected essay generation to reject candidates with missing/short model answers.');
}

if (!/const finalUsableCount = existingUsableEssayCount \+ added;/.test(aiSource)) {
  throw new Error('Expected essay generation to return usable count after inserts.');
}

if (!/existingUsableCount: existingUsableEssayCount/.test(aiSource)) {
  throw new Error('Expected observability log to include usable essay count context.');
}

console.log('essay-usable-readiness-regression.test.mjs passed');
