import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const examHttpPath = path.join(root, 'server', 'examHttp.js');
const source = await fs.readFile(examModePath, 'utf8');
const examHttp = await fs.readFile(examHttpPath, 'utf8');

assert.doesNotMatch(source, /ConvexHttpClient/, 'ExamMode must not start exams through ConvexHttpClient');
assert.doesNotMatch(source, /api\.exams\.startExamAttempt/, 'ExamMode must not call Convex exam actions');
assert.match(source, /fetch\('\/api\/exams'/, 'ExamMode must start exams through POST /api/exams');
assert.match(source, /credentials: 'include'/, 'ExamMode exam requests must send the session cookie');
assert.match(source, /shouldResume/, 'ExamMode must honor ?resume=1 by reusing the in-progress attempt');
assert.match(examHttp, /startExamForCourse/, 'exam HTTP handler must start attempts via startExamForCourse');

console.log('exam-http-start-regression.test.mjs passed');
