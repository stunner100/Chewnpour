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
  'h-[calc(100dvh-4rem)]',
  'Ask questions grounded in your generated lessons and source material.',
  '--keyboard-inset',
  'max-md:sr-only',
  'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full',
  'pt-3 md:px-8 md:pb-0 md:py-8',
]) {
  if (!tutorSource.includes(expectedSnippet)) {
    throw new Error(`Expected AIStudyTutor.jsx to include "${expectedSnippet}".`);
  }
}

if (tutorSource.includes('flex w-full flex-col gap-2 sm:w-auto sm:flex-row')) {
  throw new Error('AI Tutor pickers must sit on one row on phones so the chat keeps the remaining height.');
}

console.log('ai-tutor-spacing-regression.test.mjs passed');
