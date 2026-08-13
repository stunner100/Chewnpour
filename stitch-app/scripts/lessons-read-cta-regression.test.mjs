import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(
  path.join(root, 'src', 'pages', 'LessonMemoryNeuralBasis.jsx'),
  'utf8',
);

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Lessons page should include ${label}: ${snippet}`);
  }
};

const requireExcludes = (snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Lessons page should avoid ${label}: ${snippet}`);
  }
};

requireIncludes('Read lessons', 'a primary read CTA on course cards');
requireIncludes(
  'aria-label={`Read lessons for ${courseTitle}`}',
  'an accessible name on the read CTA',
);
requireIncludes(
  '`/dashboard/topic/${encodeURIComponent(course.firstTopicId)}`',
  'a direct link into the first lesson',
);
requireIncludes('btn-primary inline-flex w-full min-h-11', 'a full-width primary read button');
requireIncludes('Practice quiz', 'quiz as a secondary action');
requireIncludes('Timed exam', 'exam as a secondary action');
requireIncludes('btn-secondary inline-flex min-h-10', 'quieter quiz and exam buttons');

requireExcludes(
  'flex items-center justify-between gap-4 transition-opacity hover:opacity-90',
  'the icon-only arrow as the only lesson entry',
);
requireExcludes('Open lesson', 'weaker Open lesson copy on this page');

console.log('lessons-read-cta-regression.test.mjs passed');
