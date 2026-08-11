import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyStudyToolAvailability,
  findNewlyStudyReadyUploads,
  isUploadStudyReady,
  listNeedsReadinessPoll,
  studyToolEmptyCopy,
  uploadNeedsReadinessPoll,
} from '../src/lib/uploadReadiness.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

assert.equal(
  isUploadStudyReady({
    status: 'ready',
    extractionStatus: 'complete',
    courseId: 'c1',
    topicCount: 2,
  }),
  true,
);
assert.equal(
  isUploadStudyReady({
    status: 'ready',
    extractionStatus: 'complete',
    courseId: 'c1',
    topicCount: 0,
  }),
  false,
);
assert.equal(
  uploadNeedsReadinessPoll({ status: 'processing', extractionStatus: 'running' }),
  true,
);
assert.equal(
  uploadNeedsReadinessPoll({
    status: 'ready',
    extractionStatus: 'complete',
    courseId: 'c1',
    topicCount: 3,
  }),
  false,
);
assert.equal(
  listNeedsReadinessPoll(
    [{ id: 'u1', status: 'ready', extractionStatus: 'complete', courseId: 'c1', topicCount: 0 }],
    [{ id: 'c1', uploadId: 'u1', topicCount: 0 }],
  ),
  true,
);

const newlyReady = findNewlyStudyReadyUploads({
  previousUploads: [
    { id: 'u1', status: 'processing', extractionStatus: 'running', courseId: null, topicCount: 0 },
  ],
  nextUploads: [
    { id: 'u1', status: 'ready', extractionStatus: 'complete', courseId: 'c1', topicCount: 2, fileName: 'Notes.pdf' },
  ],
  previousCourses: [],
  nextCourses: [{ id: 'c1', uploadId: 'u1', title: 'Notes', topicCount: 2 }],
});
assert.equal(newlyReady.length, 1);
assert.match(newlyReady[0].lessonsHref, /\/dashboard\/lessons\?courseId=c1/);

assert.equal(classifyStudyToolAvailability({ uploads: [], courses: [] }), 'none');
assert.equal(
  classifyStudyToolAvailability({
    uploads: [{ status: 'processing', extractionStatus: 'running' }],
    courses: [],
  }),
  'processing',
);
assert.equal(
  classifyStudyToolAvailability({
    uploads: [{ status: 'ready', extractionStatus: 'complete' }],
    courses: [{ topicCount: 3, quizzesReady: 0 }],
  }),
  'topics_pending_quizzes',
);
assert.equal(
  classifyStudyToolAvailability({
    uploads: [{ status: 'ready', extractionStatus: 'complete' }],
    courses: [{ topicCount: 3, quizzesReady: 2, firstQuizTopicId: 't1' }],
  }),
  'quiz_ready',
);

assert.equal(studyToolEmptyCopy('none').ctaHref, '/dashboard/upload');
assert.equal(studyToolEmptyCopy('processing').ctaHref, '/dashboard/library');
assert.equal(studyToolEmptyCopy('topics_pending_quizzes').ctaHref, '/dashboard/lessons');

const uploadPage = await read('src/pages/UploadMaterials.jsx');
const libraryPage = await read('src/pages/MyMaterialsLibrary.jsx');
const pollHook = await read('src/hooks/useUploadReadinessPoll.js');
assert.match(uploadPage, /useUploadReadinessPoll/);
assert.match(libraryPage, /useUploadReadinessPoll/);
assert.match(pollHook, /UPLOAD_READINESS_POLL_MS|intervalMs/);
assert.match(pollHook, /Open lessons/);

console.log('upload-readiness-poll-regression.test.mjs passed');
