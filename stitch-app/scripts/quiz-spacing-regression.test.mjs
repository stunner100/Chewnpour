import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

// Focus-mode player: a quiet, centered single-column layout with no oversized
// top chrome and no dashboard spacing regressions.
const quizPlayer = await read('src/pages/TopicQuizPlayer.jsx');

for (const forbiddenSnippet of [
  'min-h-screen pt-16',
  'w-full max-w-[800px] flex flex-col gap-space-8 mt-space-8',
  'md:p-space-10',
]) {
  if (quizPlayer.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: quiz reintroduced oversized top spacing (${forbiddenSnippet}).`);
  }
}

for (const expectedSnippet of [
  'mx-auto max-w-2xl',
  'sticky top-0',
  'sticky bottom-0',
]) {
  if (!quizPlayer.includes(expectedSnippet)) {
    throw new Error(`Expected focus-mode player to include "${expectedSnippet}".`);
  }
}

// Results page keeps the quiet centered shell.
const results = await read('src/pages/DashboardResults.jsx');
for (const expectedSnippet of ['mx-auto flex w-full max-w-5xl', 'sticky top-0 z-30']) {
  if (!results.includes(expectedSnippet)) {
    throw new Error(`Expected results page to include "${expectedSnippet}".`);
  }
}

console.log('quiz-spacing-regression.test.mjs passed');
