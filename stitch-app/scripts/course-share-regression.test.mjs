import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

const migration = await read('supabase/migrations/20260813170000_question_types_and_share.sql');
const courses = await read('server/courses.js');
const courseHttp = await read('server/courseHttp.js');
const router = await read('api/router.js');
const app = await read('src/App.jsx');
const page = await read('src/pages/PublicSharedCourse.jsx');
const lessons = await read('src/pages/LessonMemoryNeuralBasis.jsx');
const vite = await read('vite.config.js');

assert.match(migration, /share_token/, 'migration must add courses.share_token');
assert.match(migration, /question_type/, 'migration must add questions.question_type');
assert.match(courses, /enableCourseShare/, 'owner opt-in share must exist');
assert.match(courses, /getPublicCourseByShareToken/, 'public share lookup must exist');
assert.doesNotMatch(
  courses.slice(courses.indexOf('export const getPublicCourseByShareToken')),
  /extracted_text|upload_id|tutor/,
  'public share payload must not include source PDF or tutor fields',
);
assert.match(courseHttp, /handleShareRequest/, 'public /api/share handler required');
assert.match(router, /handleShareRequest/, 'router must mount /api/share');
assert.match(vite, /['"]\/api\/share['"]/, 'Vite must proxy /api/share');
assert.match(app, /path="\/c\/:token"/, 'public share route must be live');
assert.match(app, /PublicSharedCourse/, 'share page must be wired');
assert.doesNotMatch(page, /ParkedFeatureView/, 'share page must be a live feature');
assert.doesNotMatch(page, /\/api\/topics\/.+\/chat/, 'shared course must not load tutor');
assert.doesNotMatch(page, /from-upload/, 'shared course must not generate');
assert.match(page, /\/api\/share\//, 'share page must load the public course API');
assert.match(lessons, /Create share link/, 'course lessons page must offer owner opt-in sharing');
assert.match(lessons, /\/api\/courses\/\$\{encodeURIComponent\(course.id\)\}\/share/, 'share toggle must call the owner API');

console.log('course-share-regression.test.mjs passed');
