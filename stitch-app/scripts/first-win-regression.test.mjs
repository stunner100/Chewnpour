import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_TOPICS, sampleCourseId } from '../server/sampleCourse.js';
import { normalizeLesson } from '../src/lib/lessonSchema.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

// Sample course content is valid lesson data with answerable quizzes.
assert.equal(SAMPLE_TOPICS.length, 3);
for (const topic of SAMPLE_TOPICS) {
    const lesson = normalizeLesson(topic.lesson);
    assert.ok(lesson, `${topic.title}: lesson must normalize`);
    assert.equal(lesson.sections.length, topic.lesson.sections.length, `${topic.title}: no section may be dropped`);
    assert.ok(topic.questions.length >= 3, `${topic.title}: needs a quiz`);
    for (const question of topic.questions) {
        assert.ok(question.options.length === 4, `${question.prompt}: four options`);
        assert.ok(Number.isInteger(question.correctIndex) && question.options[question.correctIndex], `${question.prompt}: valid answer`);
        assert.ok(question.explanation, `${question.prompt}: explanation`);
    }
}

// One sample per user, and the id does not expose the user id.
assert.equal(sampleCourseId('user_abc'), sampleCourseId('user_abc'));
assert.notEqual(sampleCourseId('user_abc'), sampleCourseId('user_abd'));
assert.ok(!sampleCourseId('user_abc').includes('user_abc'));

const [sample, courseHttp, dashboard, upload, funnel] = await Promise.all([
    read('server/sampleCourse.js'),
    read('server/courseHttp.js'),
    read('src/pages/StudentDashboard.jsx'),
    read('src/pages/UploadMaterials.jsx'),
    read('src/lib/funnelEvents.js'),
]);
assert.match(sample, /ON CONFLICT \(id\) DO NOTHING/, 'creating the sample twice returns the same course');
assert.match(sample, /ROLLBACK/, 'a failed copy leaves no half-made course');
assert.match(courseHttp, /parts\[0\] === "sample" && method === "POST"/);
assert.match(dashboard, /<SampleCourseCard placement="first_run" \/>/);
assert.match(upload, /<SampleCourseCard placement="upload_wait" compact \/>/);
assert.match(upload, /trackFunnelEvent\(FUNNEL_EVENTS\.uploadCompleted/, 'uploads report the funnel upload step');
for (const event of ['upload_completed', 'sample_course_opened']) assert.ok(funnel.includes(`'${event}'`));

console.log('first-win regression passed');
