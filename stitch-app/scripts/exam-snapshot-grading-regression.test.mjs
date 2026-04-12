import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examsSource = await fs.readFile(path.join(root, 'convex', 'exams.ts'), 'utf8');

if (!/const generatedQuestionMap = buildGeneratedQuestionMap\(attempt\);/.test(examsSource)) {
  throw new Error('Expected submitExamAttempt to read generated question snapshots.');
}

if (!/const gradingContextMap = getAttemptGradingContextMap\(attempt\);/.test(examsSource)) {
  throw new Error('Expected submitExamAttempt to read gradingContext for deterministic grading.');
}

if (!/correctAnswer = String\(gradingEntry\?\.correctAnswer \|\| question\?\.correctAnswer \|\| ""\)/.test(examsSource)) {
  throw new Error('Expected objective grading to prioritize stored gradingContext answer keys.');
}

if (!/modelAnswer: gradingEntry\.correctAnswer \|\| question\.correctAnswer \|\| ""/.test(examsSource)) {
  throw new Error('Expected essay grading to use stored gradingContext model answers.');
}

if (!/rubricPoints: Array\.isArray\(gradingEntry\.rubricPoints\)/.test(examsSource)) {
  throw new Error('Expected essay grading to use stored gradingContext rubric points.');
}

console.log('exam-snapshot-grading-regression.test.mjs passed');
