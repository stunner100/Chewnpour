import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

const quizHub = await read('src/pages/ActiveQuizSession.jsx');
const examMode = await read('src/pages/ExamMode.jsx');
const readiness = await read('src/lib/uploadReadiness.js');
const courses = await read('server/courses.js');

assert.match(readiness, /classifyStudyToolAvailability/);
assert.match(readiness, /studyToolEmptyCopy/);
assert.match(quizHub, /classifyStudyToolAvailability/);
assert.match(quizHub, /EmptyStudyToolState/);
assert.match(quizHub, /Try timed exam/);
assert.match(quizHub, /quizTopics/);
assert.doesNotMatch(quizHub, /\.slice\(0,\s*8\)/);
assert.match(examMode, /classifyStudyToolAvailability/);
assert.match(examMode, /EmptyExamState/);
assert.match(courses, /quiz_topics|quizTopics/);

console.log('study-tool-empty-state-regression.test.mjs passed');
