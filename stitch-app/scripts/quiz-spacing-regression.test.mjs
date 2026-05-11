import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const quizSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'ActiveQuizSession.jsx'),
  'utf8',
);

for (const forbiddenSnippet of [
  'min-h-screen pt-16',
  'w-full max-w-[800px] flex flex-col gap-space-8 mt-space-8',
  'md:p-space-10',
]) {
  if (quizSource.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: quiz reintroduced oversized top spacing (${forbiddenSnippet}).`);
  }
}

for (const expectedSnippet of [
  'h-[calc(100vh-64px)] overflow-hidden',
  'flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto',
  'Question {quizData.currentQuestion} of {quizData.totalQuestions}',
  'Which part of the brain is most associated with long-term memory formation?',
]) {
  if (!quizSource.includes(expectedSnippet)) {
    throw new Error(`Expected ActiveQuizSession.jsx to include "${expectedSnippet}".`);
  }
}

console.log('quiz-spacing-regression.test.mjs passed');
