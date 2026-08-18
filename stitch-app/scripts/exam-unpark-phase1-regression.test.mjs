import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const app = read('src/App.jsx');
const exam = read('src/pages/ExamMode.jsx');
const sidebar = read('src/components/app-sidebar.jsx');
const dashboard = read('src/pages/StudentDashboard.jsx');
const mobileNav = read('src/components/MobileBottomNav.jsx');
const commandPalette = read('src/components/CommandPalette.jsx');

assert.match(
  app,
  /lazyRoute\(\(\) => import\('\.\/pages\/ExamMode'\)/,
  'App must lazy-load ExamMode',
);
assert.match(
  app,
  /path="\/dashboard\/exam" element=\{withSuspense\(<ExamMode \/>/,
  'Exam hub must be a live protected dashboard route',
);
assert.match(
  app,
  /path="\/dashboard\/exam\/:topicId" element=\{<RedirectLegacyQuizRoute \/>\}/,
  'Legacy exam topic routes must redirect into the quiz player',
);
assert.doesNotMatch(
  app,
  /ParkedDashboardFeature title="Exam mode"/,
  'Exam must not stay behind ParkedDashboardFeature',
);

assert.match(exam, /\/api\/courses/, 'Exam hub must load live courses');
assert.match(exam, /autostart=mcq/, 'Exam start links must autostart MCQ quiz sessions');
assert.match(exam, /Start exam practice/, 'Exam hub must offer exam practice CTAs');
assert.doesNotMatch(exam, /ParkedFeatureView/, 'ExamMode must not render the parked stub');
assert.doesNotMatch(exam, /from ['"]convex\//i, 'ExamMode must stay Convex-free');

assert.match(sidebar, /title: 'Exam practice'/, 'Sidebar must include Exam practice');
assert.match(sidebar, /url: '\/dashboard\/exam'/, 'Sidebar Exam must point at /dashboard/exam');
assert.match(dashboard, /to: '\/dashboard\/exam'/, 'Dashboard quick actions must include Exam');
assert.match(mobileNav, /path: '\/dashboard\/exam'/, 'Mobile more menu must include Exam');
assert.match(commandPalette, /value: '\/dashboard\/exam'/, 'Command palette must include Exam');

assert.match(exam, /Exam practice/, 'Exam hub must use Exam practice labelling');
assert.match(exam, /same question bank as Quizzes/, 'Exam hub must disclose shared quiz bank');

console.log('exam-unpark-phase1-regression.test.mjs passed');
