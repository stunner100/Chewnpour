// Regression checks for the upload-to-exam backend audit fixes:
// 1. course generation is claimed before the AI call and committed atomically,
// 2. finalize only re-claims 'extracting' uploads once they are stale,
// 3. late or missed exam submits are graded from autosaved answers,
// 4. file names containing the word "image" are not rejected.
// Postgres is replaced by an in-memory fake on pg.Pool, so no database is needed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

for (const key of [
    'GRID_API_KEY',
    'DEEPSEEK_API_KEY',
    'INCEPTION_API_KEY',
    'OPENAI_API_KEY',
    'VOYAGE_API_KEY',
]) {
    delete process.env[key];
}
process.env.DATABASE_URL = 'postgres://fake:fake@127.0.0.1:1/fake';

const state = {
    courses: [],
    topics: [],
    questions: [],
    attempts: [],
    log: [],
    failOnQuestionInsert: null,
};

const uniqueViolation = () => Object.assign(new Error('duplicate key'), { code: '23505' });
const flat = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const runQuery = async (rawSql, params = []) => {
    const sql = flat(rawSql);
    state.log.push(sql);

    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };

    if (sql.startsWith('SELECT * FROM courses WHERE user_id = $1 AND upload_id = $2')) {
        const [userId, uploadId] = params;
        return { rows: state.courses.filter((c) => c.user_id === userId && c.upload_id === uploadId) };
    }
    if (sql.startsWith('INSERT INTO courses')) {
        const [id, userId, uploadId, title] = params;
        if (state.courses.some((c) => c.upload_id === uploadId)) throw uniqueViolation();
        assert.match(sql, /'generating'/, 'course must be claimed as generating before the AI call');
        state.courses.push({ id, user_id: userId, upload_id: uploadId, title, status: 'generating', updated_at: Date.now() });
        return { rows: [] };
    }
    if (sql.startsWith('UPDATE courses SET updated_at = NOW()')) {
        const [userId, uploadId, staleSeconds] = params;
        const row = state.courses.find((c) =>
            c.user_id === userId
            && c.upload_id === uploadId
            && c.status === 'generating'
            && c.updated_at < Date.now() - staleSeconds * 1000);
        if (!row) return { rows: [] };
        row.updated_at = Date.now();
        return { rows: [{ id: row.id }] };
    }
    if (sql.startsWith("UPDATE courses SET status = 'ready'")) {
        const [id, description, backend] = params;
        Object.assign(state.courses.find((c) => c.id === id), { status: 'ready', description, generation_backend: backend });
        return { rows: [] };
    }
    if (sql.startsWith("DELETE FROM courses WHERE id = $1 AND status = 'generating'")) {
        state.courses = state.courses.filter((c) => !(c.id === params[0] && c.status === 'generating'));
        return { rows: [] };
    }
    if (sql.startsWith('DELETE FROM topics WHERE course_id = $1')) {
        state.topics = state.topics.filter((t) => t.course_id !== params[0]);
        state.questions = state.questions.filter((q) => q.course_id !== params[0]);
        return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO topics')) {
        state.topics.push({ id: params[0], course_id: params[1], user_id: params[2] });
        return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO questions')) {
        if (state.failOnQuestionInsert != null) {
            state.failOnQuestionInsert -= 1;
            if (state.failOnQuestionInsert < 0) throw new Error('connection terminated');
        }
        state.questions.push({ id: params[0], course_id: params[2] });
        return { rows: [] };
    }
    if (sql.startsWith('SELECT * FROM courses WHERE id = $1 AND user_id = $2')) {
        return { rows: state.courses.filter((c) => c.id === params[0] && c.user_id === params[1]) };
    }
    if (sql.startsWith('SELECT t.*')) {
        return { rows: state.topics.filter((t) => t.course_id === params[0]) };
    }

    if (sql.startsWith('SELECT * FROM exam_attempts WHERE id = $1 AND user_id = $2')
        || sql.startsWith('SELECT ea.*, c.title AS course_title')) {
        return { rows: state.attempts.filter((a) => a.id === params[0] && a.user_id === params[1]) };
    }
    if (sql.startsWith('SELECT * FROM exam_attempts WHERE user_id = $1 AND course_id = $2')) {
        const [userId, courseId, grace] = params;
        return {
            rows: state.attempts.filter((a) =>
                a.user_id === userId
                && a.course_id === courseId
                && a.status === 'in_progress'
                && a.ends_at.getTime() < Date.now() - grace * 1000),
        };
    }
    if (sql.startsWith('SELECT id, correct_index FROM questions')) {
        return { rows: params[1].map((id) => ({ id, correct_index: 1 })) };
    }
    if (sql.startsWith('SELECT q.*, t.title AS topic_title')) {
        return { rows: params[1].map((id) => ({ id, prompt: id, options: ['a', 'b'], correct_index: 1 })) };
    }
    if (sql.startsWith('UPDATE exam_attempts SET answers = $3::jsonb, score = $4')) {
        assert.match(sql, /AND status = 'in_progress'/, 'grading UPDATE must be guarded by status');
        const [id, userId, answers, score, correctCount, status] = params;
        const row = state.attempts.find((a) => a.id === id && a.user_id === userId && a.status === 'in_progress');
        if (row) Object.assign(row, { answers: JSON.parse(answers), score, correct_count: correctCount, status });
        return { rows: [] };
    }

    return { rows: [] };
};

const fakeClient = { query: runQuery, release() {} };
pg.Pool.prototype.query = function query(sql, params) {
    return runQuery(sql, params);
};
pg.Pool.prototype.connect = async function connect() {
    return fakeClient;
};

const { ensureCourseFromUpload, COURSE_GENERATION_STALE_SECONDS } = await import('../server/courses.js');
const { isAllowedStudyUploadType } = await import('../server/uploads.js');
const { submitExamAttempt, getExamAttemptForUser } = await import('../server/exams.js');

const reset = () => {
    state.courses = [];
    state.topics = [];
    state.questions = [];
    state.attempts = [];
    state.log = [];
    state.failOnQuestionInsert = null;
};

const sourceText = [
    '# Cell biology',
    'The cell membrane controls what enters and leaves the cell. It is a phospholipid bilayer.',
    '## Mitochondria',
    'Mitochondria produce ATP through cellular respiration and have their own DNA.',
    '## Nucleus',
    'The nucleus stores genetic material and coordinates growth and reproduction.',
].join('\n\n');

const upload = { userId: 'user-1', uploadId: 'upload-1', fileName: 'Cell Biology.pdf', extractedText: sourceText };

// 1a. Concurrent finalize calls: only one generates, and the course turns ready last.
reset();
const [first, second] = await Promise.all([
    ensureCourseFromUpload(upload),
    ensureCourseFromUpload(upload),
]);
assert.equal(state.courses.length, 1, 'only one course row per upload');
assert.equal(state.courses[0].status, 'ready');
const topicInserts = state.log.filter((sql) => sql.startsWith('INSERT INTO topics')).length;
assert.equal(topicInserts, state.topics.length, 'the losing request must not insert topics');
assert.ok(state.topics.length > 0, 'the winning request inserts topics');
assert.ok([first, second].some((course) => course?.status === 'ready'));
const beginAt = state.log.indexOf('BEGIN');
const readyAt = state.log.findIndex((sql) => sql.startsWith("UPDATE courses SET status = 'ready'"));
const commitAt = state.log.indexOf('COMMIT');
const firstTopicAt = state.log.findIndex((sql) => sql.startsWith('INSERT INTO topics'));
assert.ok(beginAt >= 0 && beginAt < firstTopicAt && firstTopicAt < readyAt && readyAt < commitAt,
    'topics and the ready flip must commit in one transaction');

// 1b. A failure mid-insert rolls back and releases the claim instead of leaving a ready, partial course.
reset();
state.failOnQuestionInsert = 1;
await assert.rejects(() => ensureCourseFromUpload(upload), /connection terminated/);
assert.ok(state.log.includes('ROLLBACK'));
assert.equal(state.courses.length, 0, 'failed generation must not leave a course behind');

// 1c. A stale 'generating' claim from a killed request is taken over and finished.
reset();
state.courses.push({
    id: 'stale-course',
    user_id: upload.userId,
    upload_id: upload.uploadId,
    title: 'Cell Biology',
    status: 'generating',
    updated_at: Date.now() - (COURSE_GENERATION_STALE_SECONDS + 5) * 1000,
});
state.topics.push({ id: 'orphan', course_id: 'stale-course', user_id: upload.userId });
const recovered = await ensureCourseFromUpload(upload);
assert.equal(recovered?.id, 'stale-course');
assert.equal(state.courses[0].status, 'ready');
assert.ok(!state.topics.some((topic) => topic.id === 'orphan'), 'orphaned topics from the dead run are replaced');

// 1d. A fresh 'generating' claim is left alone.
reset();
state.courses.push({
    id: 'live-course',
    user_id: upload.userId,
    upload_id: upload.uploadId,
    title: 'Cell Biology',
    status: 'generating',
    updated_at: Date.now(),
});
const pending = await ensureCourseFromUpload(upload);
assert.equal(pending?.status, 'generating');
assert.equal(state.topics.length, 0, 'a live claim must not be regenerated');

// 2. Finalize only re-claims 'extracting' rows once stale.
const uploadsSource = await fs.readFile(path.join(process.cwd(), 'server', 'uploads.js'), 'utf8');
assert.doesNotMatch(uploadsSource, /status IN \('pending', 'error', 'extracting'\)/,
    'finalize must not re-claim fresh extracting uploads');
assert.match(uploadsSource, /status = 'extracting'\s+AND updated_at < NOW\(\) - make_interval\(secs => \$3\)/,
    'finalize may re-claim extracting uploads only after they go stale');

// 3a. A submit after the deadline grades the autosaved answers instead of failing.
const makeAttempt = (overrides = {}) => ({
    id: 'exam-1',
    user_id: 'user-1',
    course_id: 'course-1',
    course_title: 'Cell Biology',
    question_ids: ['q1', 'q2', 'q3', 'q4'],
    answers: { q1: 1, q2: 1, q3: 0 },
    total_questions: 4,
    started_at: new Date(Date.now() - 10 * 60 * 1000),
    ends_at: new Date(Date.now() - 2 * 60 * 1000),
    status: 'in_progress',
    ...overrides,
});
reset();
state.attempts.push(makeAttempt());
const late = await submitExamAttempt({ userId: 'user-1', examId: 'exam-1', answers: { q1: 1, q2: 1, q3: 1, q4: 1 } });
assert.equal(late.status, 'expired');
assert.equal(late.correctCount, 2, 'late submit is graded from the answers saved before the deadline');
assert.equal(late.score, 50);
assert.ok(Array.isArray(late.review) && late.review.length === 4);

// 3b. Reading an abandoned attempt past its deadline closes and grades it.
reset();
state.attempts.push(makeAttempt());
const abandoned = await getExamAttemptForUser('user-1', 'exam-1');
assert.equal(abandoned.status, 'expired');
assert.equal(abandoned.correctCount, 2);

// 3c. An on-time submit grades the submitted answers, and a second submit cannot overwrite it.
reset();
state.attempts.push(makeAttempt({ ends_at: new Date(Date.now() + 5 * 60 * 1000) }));
const onTime = await submitExamAttempt({ userId: 'user-1', examId: 'exam-1', answers: { q1: 1, q2: 1, q3: 1, q4: 1 } });
assert.equal(onTime.status, 'submitted');
assert.equal(onTime.correctCount, 4);
const resubmit = await submitExamAttempt({ userId: 'user-1', examId: 'exam-1', answers: {} });
assert.equal(resubmit.correctCount, 4, 'a second submit must not regrade a submitted exam');

// 4. File names containing "image" are accepted; real images are still rejected.
assert.equal(isAllowedStudyUploadType({ fileType: 'pdf', contentType: 'application/pdf', fileName: 'Medical Image Processing Week 3.pdf' }), true);
assert.equal(isAllowedStudyUploadType({ fileType: 'pptx', contentType: '', fileName: 'imagery-in-poetry.pptx' }), true);
assert.equal(isAllowedStudyUploadType({ fileType: 'png', contentType: 'image/png', fileName: 'notes.png' }), false);
assert.equal(isAllowedStudyUploadType({ fileType: 'pdf', contentType: 'image/jpeg', fileName: 'scan.pdf' }), false);
assert.equal(isAllowedStudyUploadType({ fileType: '', contentType: '', fileName: 'photo.JPG' }), false);

console.log('upload-exam-backend-hardening-regression.test.mjs passed');
process.exit(0);
