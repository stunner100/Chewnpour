import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examsPath = path.join(root, 'convex', 'exams.ts');
const source = await fs.readFile(examsPath, 'utf8');

if (!/criteriaFeedback:\s*v\.optional\(v\.array\(/.test(source)) {
  throw new Error('Expected updateExamAttemptScore to accept criteriaFeedback on essay graded answers.');
}

if (!/criterion:\s*v\.string\(\)/.test(source) || !/feedback:\s*v\.string\(\)/.test(source) || !/score:\s*v\.number\(\)/.test(source)) {
  throw new Error('Expected criteriaFeedback validator entries to capture criterion, feedback, and score.');
}

console.log('essay-submit-criteria-feedback-regression.test.mjs passed');
