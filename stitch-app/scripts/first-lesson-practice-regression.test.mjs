import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFirstLessonHref } from '../src/lib/uploadReadiness.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

assert.equal(
  buildFirstLessonHref({ course: { id: 'c1', firstTopicId: 't1' } }),
  '/dashboard/topic/t1',
);
assert.equal(
  buildFirstLessonHref({ upload: { courseId: 'c1', firstTopicId: 't9' } }),
  '/dashboard/topic/t9',
);
assert.equal(
  buildFirstLessonHref({ course: { id: 'c1' }, upload: { courseId: 'c1' } }),
  '/dashboard/lessons?courseId=c1',
);
assert.equal(buildFirstLessonHref({}), '/dashboard/lessons');

const [hook, quizPanel, uploads] = await Promise.all([
  read('src/hooks/useTopicDetail.js'),
  read('src/components/topic/TopicQuizPanel.jsx'),
  read('src/pages/UploadMaterials.jsx'),
]);

assert.match(hook, /const practicePrimary = \[\];/);
assert.match(hook, /id: 'p-start-quiz'/);
assert.match(hook, /hasQuizScore && examTopicId && \{[\s\S]*id: 'essay-rail'/);
assert.match(hook, /hasQuizScore && examTopicId && \{ id: 'p-essay'/);
assert.match(hook, /A short quiz on what you just read\./);

assert.match(quizPanel, /Test this lesson/);
assert.match(quizPanel, /Quiz done/);
assert.match(quizPanel, /A short quiz on what you just read\./);
assert.doesNotMatch(quizPanel, /Pick how you want to practice/);
assert.match(quizPanel, /topicProgress\?\.bestScore != null \? \(/);
assert.match(quizPanel, /<NextStepsGuidance/);

assert.match(uploads, /buildFirstLessonHref\(\{ upload: finalized \}\)/);
assert.match(uploads, /navigate\(first\.lessonsHref\)/);
assert.match(uploads, /fetchCourses/);
assert.match(uploads, /courses,/);

console.log('first-lesson-practice-regression.test.mjs passed');
