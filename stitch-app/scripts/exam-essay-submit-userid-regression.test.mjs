import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examsPath = path.join(root, 'convex/exams.ts');
const source = await fs.readFile(examsPath, 'utf8');

for (const pattern of [
  'const gradingUserId = String(attempt?.userId || "").trim() || undefined;',
  'userId: gradingUserId,',
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected convex/exams.ts to include "${pattern}".`);
  }
}

if (source.includes('gradeResult = await ctx.runAction(internal.ai.gradeEssayAnswer, {\n                        userId,')) {
  throw new Error('Regression detected: submitEssayExam still passes an undefined userId symbol to gradeEssayAnswer.');
}

console.log('exam-essay-submit-userid-regression.test.mjs passed');
