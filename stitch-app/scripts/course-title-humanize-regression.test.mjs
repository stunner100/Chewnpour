import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatCourseTitle } from '../src/lib/courseTitle.js';
import { stripCourseTitle } from '../server/courseGeneration.js';

const root = resolve(import.meta.dirname, '..');

assert.equal(formatCourseTitle('German_History.pdf'), 'German History');
assert.equal(
  formatCourseTitle('AI_Powered_Food_Delivery_Operations'),
  'AI-Powered Food Delivery Operations',
);
assert.equal(formatCourseTitle('intro-to-microeconomics.pdf'), 'Intro-to-Microeconomics');
assert.equal(formatCourseTitle('BIOL_201 - Cell Biology Lecture 1'), 'Biol 201 - Cell Biology Lecture 1');
assert.equal(formatCourseTitle('German History'), 'German History');
assert.equal(formatCourseTitle(''), '');
assert.equal(formatCourseTitle(null), '');

assert.equal(stripCourseTitle('German_History.pdf'), 'German History');
assert.equal(stripCourseTitle('AI_Powered_Notes.docx'), 'AI-Powered Notes');

const wiredSurfaces = [
  'src/pages/LessonMemoryNeuralBasis.jsx',
  'src/pages/StudyProgressMastery.jsx',
  'src/pages/MyMaterialsLibrary.jsx',
  'src/pages/ActiveQuizSession.jsx',
  'src/pages/ExamMode.jsx',
  'src/pages/AIStudyTutor.jsx',
  'src/pages/StudentDashboard.jsx',
  'src/components/CourseCard.jsx',
  'src/components/dashboard/ContinueLearningCard.jsx',
  'src/components/dashboard/PodcastSection.jsx',
  'src/components/topic/TopicLessonViews.jsx',
  'server/courseGeneration.js',
];

for (const relativePath of wiredSurfaces) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  assert.ok(
    source.includes('formatCourseTitle'),
    `Expected ${relativePath} to humanize course titles via formatCourseTitle.`,
  );
}

const lessonsList = readFileSync(resolve(root, 'src/pages/LessonMemoryNeuralBasis.jsx'), 'utf8');
assert.ok(
  lessonsList.includes('formatCourseTitle(topic.title)'),
  'Lessons list topic titles must go through formatCourseTitle.',
);
assert.ok(
  lessonsList.includes('This course has no topics yet') && lessonsList.includes('to="/dashboard/upload"'),
  'Empty-course lessons state must offer an Upload material CTA.',
);

assert.ok(
  readFileSync(resolve(root, 'server/courseGeneration.js'), 'utf8').includes(
    'export const stripCourseTitle',
  ),
  'Expected stripCourseTitle to remain the server-side title normalizer.',
);

console.log('course-title-humanize-regression: ok');
