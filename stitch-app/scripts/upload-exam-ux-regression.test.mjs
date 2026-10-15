import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedStudyUploadType, UNSUPPORTED_TYPE_MESSAGE } from '../server/uploads.js';
import { toReviewItems } from '../server/exams.js';
import {
  buildUploadOpenHref,
  describeUploadFailure,
  putFileWithProgress,
} from '../src/lib/uploadTransfer.js';
import {
  estimateExamShape,
  summarizeWeakTopics,
  timerAnnouncement,
} from '../src/lib/examUx.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// 1. Client-advertised types must match what the server accepts.
const uploadPage = read('src/pages/UploadMaterials.jsx');
assert.doesNotMatch(uploadPage, /\.mp4|MP4|'video\/mp4'/, 'upload page must not advertise MP4, the server rejects it');
assert.equal(
  isAllowedStudyUploadType({ fileType: 'mp4', contentType: 'video/mp4', fileName: 'lecture.mp4' }),
  false,
);
const acceptList = uploadPage.match(/ACCEPTED_FILE_TYPES = '([^']+)'/)[1].split(',');
for (const ext of acceptList) {
  const name = `notes${ext}`;
  assert.equal(
    isAllowedStudyUploadType({ fileType: ext.slice(1), contentType: '', fileName: name }),
    true,
    `server must accept advertised type ${ext}`,
  );
}
assert.match(UNSUPPORTED_TYPE_MESSAGE, /audio/i, 'unsupported-type message must mention audio');
assert.match(read('server/uploadHttp.js'), /error: UNSUPPORTED_TYPE_MESSAGE/, 'upload init 400 must reuse the full message');

// 2. Failed rows show the reason and retry finalize; Open goes to the course.
assert.equal(describeUploadFailure({ errorMessage: 'OCR failed: quota' }), 'OCR failed: quota');
assert.match(describeUploadFailure({}), /could not extract/i);
assert.equal(buildUploadOpenHref({ upload: { courseId: 'c 1' } }), '/dashboard/lessons?courseId=c%201');
assert.equal(buildUploadOpenHref({ upload: {}, course: { id: 'c2' } }), '/dashboard/lessons?courseId=c2');
assert.equal(buildUploadOpenHref({ upload: {} }), '/dashboard/library');
assert.match(uploadPage, /onClick=\{\(\) => handleRetryUpload\(upload\)\}/, 'Try again must re-run finalize');
assert.doesNotMatch(uploadPage, /to="\/dashboard\/upload"[\s\S]{0,200}Try again/, 'Try again must not link to the same page');

// 3. PUT upload reports progress and surfaces storage failures.
class FakeRequest {
  constructor(status) {
    this.status = status;
    this.upload = {};
    this.headers = {};
  }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(key, value) { this.headers[key] = value; }
  send(body) {
    this.body = body;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    this.onload();
  }
}
const seen = [];
let request;
await putFileWithProgress({
  url: 'https://storage.test/signed',
  file: 'bytes',
  contentType: 'application/pdf',
  onProgress: (value) => seen.push(value),
  createRequest: () => { request = new FakeRequest(200); return request; },
});
assert.equal(request.method, 'PUT');
assert.equal(request.headers['Content-Type'], 'application/pdf');
assert.deepEqual(seen, [25, 100, 100]);
await assert.rejects(
  putFileWithProgress({ url: 'x', file: 'y', createRequest: () => new FakeRequest(403) }),
  /Storage responded with 403/,
);
assert.match(uploadPage, /Uploading \$\{uploadPercent\}%/, 'dropzone must show upload percentage');

// 4. Exam start confirmation, exit confirmation, timer announcements, radio semantics.
assert.deepEqual(
  estimateExamShape({ quizTopics: [{ questionCount: 3 }, { questionCount: 2 }] }),
  { questionCount: 5, durationSeconds: 300, durationMinutes: 5 },
);
assert.equal(
  estimateExamShape({ quizTopics: Array.from({ length: 10 }, () => ({ questionCount: 3 })) }).questionCount,
  20,
  'start confirmation must mirror the server question cap',
);
assert.equal(timerAnnouncement(300), '5 minutes remaining');
assert.equal(timerAnnouncement(60), '1 minute remaining');
assert.equal(timerAnnouncement(10), '10 seconds remaining');
assert.equal(timerAnnouncement(299), null, 'timer must not announce every second');

const examPage = read('src/pages/ExamMode.jsx');
assert.match(examPage, /onClick=\{\(\) => setPendingStartCourse\(course\)\}/, 'starting an exam must confirm first');
assert.match(examPage, /title="Start timed exam\?"/);
assert.match(examPage, /title="Leave this exam\?"/, 'exit must confirm while the timer runs');
assert.doesNotMatch(examPage, /aria-label=\{`\$\{timeRemaining\} seconds remaining`\}/, 'timer label must not change every second');
assert.match(examPage, /role="timer"/);
assert.match(examPage, /role="radiogroup"/);
assert.match(examPage, /role="radio"\s+aria-checked=\{selected\}/);
assert.doesNotMatch(examPage, /window\.confirm/, 'exam confirmations must use the app dialog');
const submitButtons = examPage.match(/onClick=\{requestSubmit\}/g) || [];
assert.equal(submitButtons.length, 2, 'submit must be reachable before the last question');

// 5. Exam review carries explanation and topic, and links weak topics.
const review = toReviewItems(
  [
    { id: 'q1', prompt: 'P1', options: '["a","b"]', correct_index: 0, explanation: 'Because a.', topic_id: 't1', topic_title: 'Memory' },
    { id: 'q2', prompt: 'P2', options: ['a', 'b'], correct_index: 1, explanation: null, topic_id: 't1', topic_title: 'Memory' },
    { id: 'q3', prompt: 'P3', options: ['a', 'b'], correct_index: 1, explanation: '', topic_id: 't2', topic_title: 'Attention' },
  ],
  { q1: 1, q3: 1 },
);
assert.equal(review[0].explanation, 'Because a.');
assert.equal(review[0].topicTitle, 'Memory');
assert.equal(review[1].explanation, '');
assert.deepEqual(summarizeWeakTopics(review), [
  { topicId: 't1', topicTitle: 'Memory', missed: 2 },
]);
assert.match(read('server/exams.js'), /LEFT JOIN topics t ON t\.id = q\.topic_id/, 'review must load topic titles');
assert.match(examPage, /Review these lessons/);
assert.match(examPage, /\/dashboard\/topic\/\$\{encodeURIComponent\(topic\.topicId\)\}/);

console.log('upload-exam-ux-regression.test.mjs passed');
