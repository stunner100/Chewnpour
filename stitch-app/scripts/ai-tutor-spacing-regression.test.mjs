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
]) {
  if (!tutorSource.includes(expectedSnippet)) {
    throw new Error(`Expected AIStudyTutor.jsx to include "${expectedSnippet}".`);
  }
}

console.log('ai-tutor-spacing-regression.test.mjs passed');
