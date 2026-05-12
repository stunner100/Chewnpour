import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const tutorSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'AIStudyTutor.jsx'),
  'utf8',
);

for (const forbiddenSnippet of [
  'min-h-screen pt-16',
  'min-h-[calc(100vh-64px)]',
  'h-[calc(100vh-220px)]',
  'min-h-[500px]',
]) {
  if (tutorSource.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: AI Tutor reintroduced oversized viewport spacing (${forbiddenSnippet}).`);
  }
}

for (const expectedSnippet of [
  'h-[calc(100vh-64px)] overflow-hidden',
  'flex-1 min-h-0 flex flex-col p-space-4 md:p-space-8 max-w-container-max mx-auto w-full',
  'flex-1 min-h-0 bg-surface rounded-2xl border border-border-subtle shadow-sm flex flex-col overflow-hidden',
  'flex-1 min-h-0 overflow-y-auto p-space-6 flex flex-col gap-space-8',
  'Your personal academic assistant, ready to help you understand complex topics.',
]) {
  if (!tutorSource.includes(expectedSnippet)) {
    throw new Error(`Expected AIStudyTutor.jsx to include "${expectedSnippet}".`);
  }
}

console.log('ai-tutor-spacing-regression.test.mjs passed');
