import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

const examsSource = await read('server/exams.js');
const examHttp = await read('server/examHttp.js');
const router = await read('api/router.js');
const examUi = await read('src/pages/ExamMode.jsx');
const examTimer = await read('src/hooks/useExamTimer.js');
const migration = await read('supabase/migrations/20260811211000_exam_attempts.sql');

assert.match(examsSource, /startExamForCourse/, 'exams must support start');
assert.match(examsSource, /submitExamAttempt/, 'exams must support submit');
assert.match(examsSource, /toPlayableQuestion/, 'GET path must strip answers');
assert.match(examsSource, /toReviewItems/, 'submitted exams must build review');
assert.match(examsSource, /EXAM_EXPIRED/, 'late submit must reject');
assert.doesNotMatch(
  examsSource.slice(
    examsSource.indexOf('const toPlayableQuestion'),
    examsSource.indexOf('const parseOptions'),
  ),
  /correctIndex|correct_index|explanation/,
  'playable exam questions must omit answer key fields',
);
assert.match(
  examsSource.slice(examsSource.indexOf('const toReviewItems')),
  /correctIndex/,
  'review items must include correctIndex after submit',
);
assert.match(examHttp, /handleExamsRequest/, 'exam HTTP handler required');
assert.match(router, /handleExamsRequest/, 'router must mount /api/exams');
assert.match(examUi, /useExamTimer/, 'exam UI must use countdown timer');
assert.match(examUi, /setTimeRemaining/, 'exam UI must sync timer after start');
assert.match(examUi, /answersRef/, 'time-up submit must use answers ref');
assert.match(examUi, /timedOut/, 'time-up must use distinct toast path');
assert.match(examUi, /Skipped/, 'review must distinguish skipped answers');
assert.match(examUi, /dark:bg-red-950/, 'review cards need dark-mode contrast');
assert.match(examUi, /unansweredCount/, 'submit must warn on unanswered');
assert.match(examUi, /\/api\/exams/, 'exam UI must call exam APIs');
assert.doesNotMatch(examUi, /Exam practice/, 'practice-only copy must be removed');
assert.match(examTimer, /timeUpFiredRef/, 'timer must fire onTimeUp once');
assert.match(examTimer, /setTimeRemaining/, 'timer must expose resume setter');
assert.match(migration, /exam_attempts/, 'exam_attempts migration required');

console.log('timed-exam-regression.test.mjs passed');
