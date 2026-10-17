// Background lesson generation on a scratch database: one course and one job
// per upload; the job lifecycle (queued -> running -> partly written ->
// ready); a course listed as soon as its first lesson is saved; Regenerate
// for one lesson (same topic, new content) and for the whole course; writing
// parts that have no lesson yet; and restarting a stalled job.
import assert from 'node:assert/strict';
import process from 'node:process';
import { createScratchDb, seedCourse } from './lib/scratchDb.mjs';

console.warn = () => {};
// Kicks go to a closed port, so no worker races the jobs this test runs.
process.env.GENERATION_WORKER_URL = 'http://127.0.0.1:9/api/generation-worker';
process.env.GENERATION_WORKER_SECRET = 'test-secret';
// A provider key makes lesson requests allowed; no real call is made, since
// every job here runs with the stub model.
process.env.COURSE_AI_ENABLED = 'true';
process.env.GRID_API_KEY = 'test-key';

const scratch = await createScratchDb('generation_jobs');
const { getPool } = await import('../server/db.js');
const jobs = await import('../server/generationJobs.js');
const courses = await import('../server/courses.js');
const db = getPool();

const chapter = (title, sentence) => [`# ${title}`, Array.from({ length: 30 }, () => sentence).join(' ')].join('\n\n');
const SOURCE = [
    chapter('Osmosis', 'Osmosis moves water across a membrane toward the more concentrated solution.'),
    chapter('Diffusion', 'Diffusion spreads particles from high concentration to low concentration.'),
    chapter('Active transport', 'Active transport pumps substances against their gradient using energy from ATP.'),
].join('\n\n');

// Stub model: a lesson per heading; each lesson quotes its own source.
let lessonVersion = 1;
const lessonCalls = [];
const chat = async ({ messages }) => {
    const system = messages[0].content;
    const user = messages[1].content;
    if (system.startsWith("You are ChewnPour's study curriculum planner.")) {
        const parts = [...user.matchAll(/^\[(\d+)\] (.+?) \(\d+ chars\)/gm)];
        const starts = parts.filter((match, index) => index === 0 || match[2] !== parts[index - 1][2]);
        return {
            provider: 'stub',
            text: JSON.stringify({ lessons: starts.map((match) => ({ title: match[2], kind: 'concept', firstPart: Number(match[1]) })) }),
        };
    }
    if (system.startsWith("You are ChewnPour's quiz writer.")) {
        return { provider: 'stub', text: JSON.stringify({ questions: [], inLessonChecks: [], ordering: null }) };
    }
    const title = user.match(/^Lesson title: (.+)$/m)[1];
    const sourceText = user.match(/\(untrusted data\):\n(`{3,})\n([\s\S]*)\n\1$/)[2];
    const quote = sourceText.split('\n').find((line) => line && !line.startsWith('#')).split('.')[0];
    lessonCalls.push(title);
    return {
        provider: 'stub',
        text: JSON.stringify({
            lesson: {
                sections: [{ title: `How ${title} works (v${lessonVersion})`, role: 'core', body: `${quote}.`, sourceQuote: quote }],
                recap: [],
                wordBank: [],
            },
        }),
    };
};
const run = (job, options = {}) => jobs.runGenerationJob(job, { chat, aiEnabled: () => true, ...options });
const courseRow = async (courseId) => (await db.query('SELECT * FROM courses WHERE id = $1', [courseId])).rows[0];
const topicsOf = async (courseId) => (await db.query('SELECT * FROM topics WHERE course_id = $1 ORDER BY sort_order', [courseId])).rows;
const activeJobs = async (courseId) => (await db.query(
    "SELECT * FROM generation_jobs WHERE course_id = $1 AND status IN ('queued', 'running')",
    [courseId],
)).rows;

// 1. Two requests for the same upload create one course and one job.
{
    await seedCourse(db, { id: 'race', extractedText: SOURCE });
    await db.query("DELETE FROM courses WHERE id = 'course_race'");
    const args = { userId: 'user_race', uploadId: 'upload_race', fileName: 'cells.pdf', extractedText: SOURCE };
    const [first, second] = await Promise.all([courses.ensureCourseGeneration(args), courses.ensureCourseGeneration(args)]);
    assert.equal(first.id, second.id);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM courses WHERE upload_id = 'upload_race'")).rows[0].n, 1);
    assert.equal((await activeJobs(first.id)).length, 1, 'one queued job');
    assert.equal(first.status, 'generating');
    assert.equal(first.generation.active, true);
    await assert.rejects(
        courses.ensureCourseGeneration({ ...args, uploadId: 'upload_missing', extractedText: '' }),
        /without extracted text/,
    );
}

// 2. Lifecycle: queued -> running -> partly written (listed, first lesson
// open) -> ready.
const ids = await seedCourse(db, { id: 'life', extractedText: SOURCE });
{
    const queued = await jobs.enqueueGenerationJob({ courseId: ids.courseId, userId: ids.userId, uploadId: ids.uploadId });
    assert.equal(queued.status, 'queued');
    assert.deepEqual(await courses.listCoursesForUser(ids.userId), [], 'a course with no lessons is not listed yet');

    const running = await jobs.claimGenerationJob({ jobId: queued.id });
    assert.equal(running.status, 'running');
    assert.ok(new Date(running.locked_until) > new Date(), 'the worker holds a lease');
    let clock = 0;
    const partial = await run(running, { startBudgetMs: 25_000, now: () => (clock += 10_000) });
    assert.equal(partial.status, 'requeued');

    const listed = await courses.listCoursesForUser(ids.userId);
    assert.equal(listed.length, 1, 'listed as soon as a lesson is saved');
    assert.equal(listed[0].status, 'generating');
    assert.equal(listed[0].generation.active, true);
    assert.ok(listed[0].firstTopicId, 'the first lesson can be opened');
    const upload = await db.query("SELECT processing_step FROM uploads WHERE id = $1", [ids.uploadId]);
    assert.equal(upload.rows[0].processing_step, 'writing');

    const done = await run(await jobs.claimGenerationJob({ jobId: queued.id }));
    assert.equal(done.status, 'done');
    const course = await courses.getCourseForUser(ids.userId, ids.courseId);
    assert.equal(course.status, 'ready');
    assert.equal(course.generation.active, false);
    assert.deepEqual(course.topics.map((topic) => topic.title), ['Osmosis', 'Diffusion', 'Active transport']);
    assert.deepEqual(course.lessonPlan.map((entry) => entry.status), ['written', 'written', 'written']);
    assert.equal((await db.query("SELECT processing_step FROM uploads WHERE id = $1", [ids.uploadId])).rows[0].processing_step, 'ready');
}

// 3. Regenerate one lesson: same topic id, new content; the rest untouched.
{
    const before = await topicsOf(ids.courseId);
    const target = before[1];
    const queuedCourse = await courses.regenerateTopicForUser(ids.userId, target.id);
    assert.deepEqual(queuedCourse.generation, { active: true, kind: 'lessons', planIndexes: [1] });

    // While a lessons job is active, more lessons join it.
    const [job] = await activeJobs(ids.courseId);
    lessonVersion = 2;
    lessonCalls.length = 0;
    await run(await jobs.claimGenerationJob({ jobId: job.id }));
    const after = await topicsOf(ids.courseId);
    assert.deepEqual(after.map((topic) => topic.id), before.map((topic) => topic.id), 'topic ids are kept');
    assert.deepEqual(lessonCalls, ['Diffusion'], 'only that lesson is rewritten');
    assert.match(after[1].lesson.sections[0].title, /\(v2\)/);
    assert.match(after[0].lesson.sections[0].title, /\(v1\)/);
    assert.equal((await courseRow(ids.courseId)).status, 'ready');
    await assert.rejects(courses.regenerateTopicForUser('someone-else', target.id), /Topic not found/);
}

// 4. A lesson that fails to regenerate keeps its current version.
{
    const [target] = await topicsOf(ids.courseId);
    await courses.regenerateTopicForUser(ids.userId, target.id);
    const [job] = await activeJobs(ids.courseId);
    const failing = async (args) => {
        if (args.messages[0].content.startsWith("You are ChewnPour's study lesson writer.")) throw new Error('stub 502');
        return chat(args);
    };
    await jobs.runGenerationJob(await jobs.claimGenerationJob({ jobId: job.id }), { chat: failing, aiEnabled: () => true });
    const [kept] = await topicsOf(ids.courseId);
    assert.equal(kept.id, target.id);
    assert.deepEqual(kept.lesson, target.lesson, 'the old lesson stays');
    const plan = (await courseRow(ids.courseId)).lesson_plan;
    assert.equal(plan[0].status, 'written');
    assert.equal((await db.query('SELECT error FROM generation_jobs WHERE id = $1', [job.id])).rows[0].error, '1 lesson(s) could not be written.');
}

// 5. Parts without lessons can be written on request; written parts cannot.
{
    await db.query(
        `UPDATE courses SET lesson_plan = jsonb_set(lesson_plan, '{2}', (lesson_plan -> 2) || '{"status":"pending","topicId":null}'::jsonb) WHERE id = $1`,
        [ids.courseId],
    );
    await db.query('DELETE FROM topics WHERE course_id = $1 AND sort_order = 2', [ids.courseId]);
    await assert.rejects(courses.generatePlannedLessonsForUser(ids.userId, ids.courseId, [0]), /No unwritten parts/);
    const queuedCourse = await courses.generatePlannedLessonsForUser(ids.userId, ids.courseId, [2, 2, 0]);
    assert.deepEqual(queuedCourse.generation.planIndexes, [2]);
    const [job] = await activeJobs(ids.courseId);
    await run(await jobs.claimGenerationJob({ jobId: job.id }));
    const plan = (await courseRow(ids.courseId)).lesson_plan;
    assert.equal(plan[2].status, 'written');
    assert.equal((await topicsOf(ids.courseId)).length, 3);
}

// 6. While the course job is still writing, a single-lesson request waits.
{
    const other = await seedCourse(db, { id: 'busy', extractedText: SOURCE });
    const job = await jobs.enqueueGenerationJob({ courseId: other.courseId, userId: other.userId, uploadId: other.uploadId });
    let clock = 0;
    await run(await jobs.claimGenerationJob({ jobId: job.id }), { startBudgetMs: 15_000, now: () => (clock += 10_000) });
    const [firstTopic] = await topicsOf(other.courseId);
    await assert.rejects(courses.regenerateTopicForUser(other.userId, firstTopic.id), /still being written/);
}

// 7. Regenerate the whole course: lessons replaced, plan rebuilt, the old job
// replaced by a new course job.
{
    const before = await topicsOf(ids.courseId);
    const restarted = await courses.regenerateCourseForUser(ids.userId, ids.courseId);
    assert.equal(restarted.status, 'generating');
    assert.equal(restarted.topics.length, 0);
    assert.deepEqual(restarted.lessonPlan, []);
    const [job] = await activeJobs(ids.courseId);
    assert.equal(job.kind, 'course');
    await run(await jobs.claimGenerationJob({ jobId: job.id }));
    const after = await topicsOf(ids.courseId);
    assert.equal(after.length, 3);
    assert.ok(after.every((topic) => !before.some((old) => old.id === topic.id)), 'every lesson is new');
    assert.equal((await courseRow(ids.courseId)).status, 'ready');
}

// 8. A stalled job is restarted by status reads; a fresh one is left alone.
{
    const stalled = await seedCourse(db, { id: 'stalled', extractedText: SOURCE });
    const job = await jobs.enqueueGenerationJob({ courseId: stalled.courseId, userId: stalled.userId, uploadId: stalled.uploadId });
    assert.equal(await jobs.resumeStalledGeneration(stalled.courseId), false, 'a job queued just now has a worker coming');
    await db.query(`UPDATE generation_jobs SET status = 'running', locked_until = NOW() - INTERVAL '1 second' WHERE id = $1`, [job.id]);
    assert.equal(await jobs.resumeStalledGeneration(stalled.courseId), true, 'an expired lease is restarted');
    await db.query(`UPDATE generation_jobs SET status = 'queued', locked_until = NULL, updated_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [job.id]);
    assert.equal(await jobs.resumeStalledGeneration(stalled.courseId), true, 'a job left in the queue is restarted');
    // A job whose workers keep dying is given up.
    await db.query(`UPDATE generation_jobs SET attempts = 6 WHERE id = $1`, [job.id]);
    const result = await run(await jobs.claimGenerationJob({ jobId: job.id }));
    assert.equal(result.status, 'failed');
    assert.equal((await courseRow(stalled.courseId)).status, 'failed');
}

// Without a model, lesson requests are refused instead of queued to fail.
{
    process.env.COURSE_AI_ENABLED = 'false';
    const [topic] = await topicsOf(ids.courseId);
    await assert.rejects(courses.regenerateTopicForUser(ids.userId, topic.id), { status: 503, code: 'AI_UNAVAILABLE' });
    process.env.COURSE_AI_ENABLED = 'true';
}

// 9. The worker endpoint only runs for the app's own secret.
{
    const { default: worker } = await import('../api/generation-worker.js');
    const { Readable } = await import('node:stream');
    const call = async (authorization, body = {}) => {
        const req = Object.assign(Readable.from([JSON.stringify(body)]), {
            method: 'POST',
            headers: authorization ? { authorization } : {},
        });
        const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(text) { this.body = JSON.parse(text); } };
        await worker(req, res);
        return res;
    };
    assert.equal((await call(null)).statusCode, 401);
    assert.equal((await call('Bearer wrong-secret')).statusCode, 401);
    const accepted = await call('Bearer test-secret', { jobId: 'no-such-job' });
    assert.equal(accepted.statusCode, 202);
    assert.deepEqual(accepted.body, { accepted: true, jobId: 'no-such-job' });
    await new Promise((resolve) => setTimeout(resolve, 200));
}

await db.end();
await scratch.drop();
console.log('generation-jobs-regression.test.mjs passed');
