import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDocumentTitle, resolveRouteTitle } from '../src/lib/documentTitle.js';

// Every route names its tab; subject pages name it after the lesson, quiz or course.
assert.equal(formatDocumentTitle('Cell Theory'), 'Cell Theory · ChewnPour');
assert.equal(formatDocumentTitle('  '), 'ChewnPour');
assert.equal(resolveRouteTitle('/'), 'ChewnPour');
assert.equal(resolveRouteTitle('/dashboard'), 'Dashboard · ChewnPour');
assert.equal(resolveRouteTitle('/dashboard/library'), 'My Materials · ChewnPour');
assert.equal(resolveRouteTitle('/dashboard/progress'), 'Progress · ChewnPour');
assert.equal(resolveRouteTitle('/dashboard/quiz/results/abc'), 'Quiz results · ChewnPour');
assert.equal(resolveRouteTitle('/dashboard/quiz/topic-1'), 'Quizzes · ChewnPour');
assert.equal(resolveRouteTitle('/dashboard/topic/topic-1'), 'Lesson · ChewnPour');
assert.equal(resolveRouteTitle('/signup'), 'Sign up · ChewnPour');
assert.equal(resolveRouteTitle('/c/share-token'), 'Shared course · ChewnPour');
assert.equal(resolveRouteTitle('/dashboardx'), 'ChewnPour', 'prefixes match whole path segments');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const app = read('src/App.jsx');
assert.match(app, /useLayoutEffect\(\(\) => \{\s*document\.title = resolveRouteTitle\(routerLocation\.pathname\);/,
  'the route default must be set in a layout effect so page titles win');
assert.match(read('src/components/topic/TopicLessonViews.jsx'), /useDocumentTitle\(resolvedTopicTitle/);
assert.match(read('src/pages/TopicQuizPlayer.jsx'), /useDocumentTitle\(quiz\?\.topic\?\.title/);
assert.match(read('src/pages/LessonMemoryNeuralBasis.jsx'), /useDocumentTitle\(selectedCourse/);

console.log('document-title-regression.test.mjs passed');
