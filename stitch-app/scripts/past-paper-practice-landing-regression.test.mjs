import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePracticeOutcome, resolvePreferredExamCourse } from '../src/lib/pastQuestions.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// "Practise as exam" lands on that paper's exam and asks to start it.
assert.equal(
    resolvePracticeOutcome({ upload: { courseId: 'c1' } }).href,
    '/dashboard/exam?courseId=c1&start=1',
);

// A just-imported paper is listed before its quiz questions are written.
const courses = [
    { id: 'ready', quizzesReady: 3 },
    { id: 'writing', quizzesReady: 0 },
];
assert.deepEqual(resolvePreferredExamCourse({ courses, preferredCourseId: '' }), { state: 'none', course: null });
assert.equal(resolvePreferredExamCourse({ courses, preferredCourseId: 'ready' }).state, 'ready');
assert.equal(resolvePreferredExamCourse({ courses, preferredCourseId: 'writing' }).state, 'preparing');
assert.equal(resolvePreferredExamCourse({ courses, preferredCourseId: 'gone' }).state, 'missing');

const exam = await fs.readFile(path.join(root, 'src/pages/ExamMode.jsx'), 'utf8');
assert.match(exam, /searchParams\.get\('start'\) === '1'/);
assert.match(exam, /setPendingStartCourse\(preferredExam\.course\)/, 'a ready paper opens its start confirmation, not the bare list');
assert.match(exam, /setInterval\(\(\) => load\(\{ silent: true \}\), 5000\)/, 'waits for the questions to be written');
assert.match(exam, /setTimeout\(\(\) => setWaitTimedOut\(true\), 180000\)/, 'and stops waiting after 3 minutes');
assert.match(exam, /Writing exam questions for/);
assert.match(exam, /=== 1 \? 'topic' : 'topics'/, 'singular "topic"');

console.log('past-paper-practice-landing regression passed');
