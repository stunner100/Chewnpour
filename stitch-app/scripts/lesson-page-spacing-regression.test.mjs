import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const lessonSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'LessonMemoryNeuralBasis.jsx'),
  'utf8',
);

if (lessonSource.includes('pb-20 md:pb-0 pt-16')) {
  throw new Error('Regression detected: lesson page reintroduced duplicate top padding below DashboardLayout.');
}

for (const expectedSnippet of [
  'flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0',
  'pt-space-6 pb-space-8 md:pt-space-8 md:pb-space-10 lg:pt-space-8 lg:pb-space-12',
  'hidden lg:flex w-[320px] shrink-0 border-l border-border-subtle bg-surface-soft flex-col h-[calc(100vh-64px)] sticky top-0 self-start',
  'placeholder="Ask a question..."',
]) {
  if (!lessonSource.includes(expectedSnippet)) {
    throw new Error(`Expected LessonMemoryNeuralBasis.jsx to include "${expectedSnippet}".`);
  }
}

console.log('lesson-page-spacing-regression.test.mjs passed');
