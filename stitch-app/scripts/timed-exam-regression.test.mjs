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
const migration = await read('supabase/migrations/20260811211000_exam_attempts.sql');

assert.match(examsSource, /startExamForCourse/, 'exams must support start');
assert.match(examsSource, /submitExamAttempt/, 'exams must support submit');
assert.match(examsSource, /toPlayableQuestion/, 'GET path must strip answers');
assert.match(examsSource, /EXAM_EXPIRED/, 'late submit must reject');
assert.doesNotMatch(
  examsSource.slice(
    examsSource.indexOf('const toPlayableQuestion'),
    examsSource.indexOf('const shuffle'),
  ),
  /correctIndex|correct_index|explanation/,
  'playable exam questions must omit answer key fields',
);
assert.match(examHttp, /handleExamsRequest/, 'exam HTTP handler required');
assert.match(router, /handleExamsRequest/, 'router must mount /api/exams');
assert.match(examUi, /useExamTimer/, 'exam UI must use countdown timer');
assert.match(examUi, /\/api\/exams/, 'exam UI must call exam APIs');
assert.doesNotMatch(examUi, /Exam practice/, 'practice-only copy must be removed');
assert.match(migration, /exam_attempts/, 'exam_attempts migration required');

console.log('timed-exam-regression.test.mjs passed');
