import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

const examsSource = await read('server/exams.js');
const examHttp = await read('server/examHttp.js');
const examUi = await read('src/pages/ExamMode.jsx');

assert.match(examsSource, /export const saveExamAnswers/, 'exams must export saveExamAnswers');
assert.match(
  examsSource,
  /status = 'in_progress'[\s\S]*ends_at > NOW\(\)/,
  'saveExamAnswers must update only in-progress attempts that have not ended',
);
assert.doesNotMatch(
  examsSource.slice(
    examsSource.indexOf('export const saveExamAnswers'),
    examsSource.indexOf('export const submitExamAttempt'),
  ),
  /ConvexHttpClient|api\.exams/,
  'exam answer persistence must stay on the Postgres HTTP path',
);

assert.match(examHttp, /saveExamAnswers/, 'exam HTTP handler must mount saveExamAnswers');
assert.match(
  examHttp,
  /method === "PATCH" && parts\.length === 2 && parts\[1] === "answers"/,
  'PATCH /api/exams/:id/answers must be mounted',
);

assert.match(examUi, /method: 'PATCH'/, 'ExamMode must PATCH answers while the attempt is live');
assert.match(examUi, /\/api\/exams\/\$\{exam\.id\}\/answers/, 'ExamMode must save to the answers endpoint');
assert.match(examUi, /visibilitychange/, 'ExamMode must flush answers on visibilitychange');
assert.match(examUi, /pagehide/, 'ExamMode must flush answers on pagehide');
assert.match(examUi, /keepalive: true/, 'hidden-tab flush must use keepalive fetch');
assert.match(examUi, /setTimeout\(\(\) => \{\s*void saveExamAnswers\(answers\);/, 'answer changes must debounce-save');
assert.match(examUi, /resume=1|shouldResume/, 'resume query must remain wired');

console.log('exam-answer-persist-regression.test.mjs passed');
