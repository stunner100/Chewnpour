import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuestionsForTopic } from '../server/courseGeneration.js';
import { extractTextFromOcrSpaceResult } from '../server/ocrSpaceClient.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

const uploadsSource = await read('server/uploads.js');
const uploadHttp = await read('server/uploadHttp.js');
const coursesSource = await read('server/courses.js');
const ocrSource = await read('server/ocrSpaceClient.js');
const migration = await read('supabase/migrations/20260811140000_upload_idempotency_uniques.sql');
const resetSource = await read('src/pages/ResetPassword.jsx');
const loginSource = await read('src/pages/Login.jsx');
const examSource = await read('src/pages/ExamMode.jsx');

assert.match(ocrSource, /callOcrSpace/, 'OCR.space client must export caller');
assert.match(uploadsSource, /callOcrSpace/, 'finalize must call OCR.space fallback');
assert.match(uploadsSource, /persistExtractionFailure/, 'empty extracts must fail without charging');
assert.doesNotMatch(
  uploadsSource,
  /extraction_status: "deferred"/,
  'deferred ready+charge path must be removed',
);
assert.doesNotMatch(uploadsSource, /callAzureDocIntelLayout/, 'Azure OCR fallback must be removed');
assert.match(uploadsSource, /isAllowedStudyUploadType/, 'init must validate allowed study types');
assert.match(uploadsSource, /deleteUploadForUser/, 'uploads must support delete');
assert.match(uploadHttp, /method === "DELETE"/, 'upload HTTP must expose DELETE');

assert.match(coursesSource, /toPlayableQuestion/, 'quiz GET must use playable DTO');
assert.match(
  coursesSource,
  /getQuizForTopicWithAnswers/,
  'submit must grade with full answers server-side',
);

const playableStart = coursesSource.indexOf('const toPlayableQuestion');
const playableEnd = coursesSource.indexOf('export const getCourseByUploadId');
const playableBlock = coursesSource.slice(playableStart, playableEnd > playableStart ? playableEnd : playableStart + 500);
assert.doesNotMatch(playableBlock, /correctIndex/, 'playable quiz DTO must omit correctIndex');
assert.doesNotMatch(playableBlock, /explanation/, 'playable quiz DTO must omit explanation');

assert.match(migration, /courses_upload_id_unique/, 'courses upload_id uniqueness');
assert.match(migration, /credit_ledger_spend_upload_unique/, 'one spend per upload');

assert.match(resetSource, /Password reset unavailable/, 'reset page must be honest stub');
assert.doesNotMatch(loginSource, /Forgot password\?/, 'login must hide broken forgot-password link');
assert.match(examSource, /Exam practice/, 'exam hub uses practice labelling');
assert.match(examSource, /same question bank as Quizzes/, 'exam hub discloses shared quiz bank');

const ocrText = extractTextFromOcrSpaceResult({
  ParsedResults: [
    { ParsedText: 'Photosynthesis converts light into chemical energy.' },
  ],
  OCRExitCode: 1,
  IsErroredOnProcessing: false,
});
assert.equal(ocrText.includes('Photosynthesis'), true);

const questions = buildQuestionsForTopic({
  topicTitle: 'Biology',
  topicContent:
    'Photosynthesis converts light energy into chemical energy in plants. Mitochondria produce ATP during cellular respiration. DNA stores genetic information in the nucleus.',
  limit: 3,
});
assert.ok(questions.length > 0, 'heuristic questions should generate');
for (const question of questions) {
  assert.ok(question.options.length >= 2);
  assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
}

console.log('top5-qa-fixes-regression.test.mjs passed', {
  questionCount: questions.length,
});
