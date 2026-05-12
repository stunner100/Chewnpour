import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const flashcardSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'FlashcardStudySession.jsx'),
  'utf8',
);

for (const forbiddenSnippet of [
  'min-h-screen pt-16',
  'items-center justify-center p-space-8',
]) {
  if (flashcardSource.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: flashcards reintroduced oversized top spacing (${forbiddenSnippet}).`);
  }
}

for (const expectedSnippet of [
  'h-[calc(100vh-64px)] overflow-hidden',
  'flex-1 min-h-0 flex flex-col items-center justify-start px-space-8 pt-space-8 pb-space-8 overflow-y-auto',
  'api.courses.getUserCourses',
  'api.topics.getResumeTarget',
]) {
  if (!flashcardSource.includes(expectedSnippet)) {
    throw new Error(`Expected FlashcardStudySession.jsx to include "${expectedSnippet}".`);
  }
}

console.log('flashcard-spacing-regression.test.mjs passed');
