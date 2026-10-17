// Runs the background generation job (server/generationJobs.js) on a scratch
// database with a stubbed LLM to check what happens when generation goes
// wrong: truncated replies, a lesson that cannot be written, a quiz call that
// fails, the worker's time budget, a worker killed mid-job, every provider
// failing, and a table-of-contents source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScratchDb, seedCourse } from './lib/scratchDb.mjs';
import { LlmTruncatedError } from '../server/llmClient.js';

// The generator logs every failure it recovers from; these runs fail on purpose.
console.warn = () => {};

const scratch = await createScratchDb('failure_modes');
const { getPool } = await import('../server/db.js');
const { claimGenerationJob, enqueueGenerationJob, runGenerationJob } = await import('../server/generationJobs.js');
const db = getPool();

const sourceDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sources');
const readSource = (name) => fs.readFileSync(path.join(sourceDir, name), 'utf8');
const cellNotes = readSource('toc-heavy-cell-biology.md');
const loopNotes = readSource('python-loops-notes.md');
const scannedPdfText = readSource('scanned-page-numbers.txt');


const CELL_TOPICS = [
    {
        title: 'Cell Structure',
        quote: 'their DNA sits in a region called the nucleoid',
        focus: 'Cell Structure',
        kind: 'concept',
        facts: ['the nucleoid', 'the Golgi apparatus', 'a cell wall made of cellulose', 'Lysosomes'],
        prompts: ['Where does a prokaryote keep its DNA?', 'Which organelle packages proteins into vesicles?', 'What do plant cells have that animal cells lack?', 'Which structures digest worn-out organelles?'],
    },
    {
        title: 'Membrane Transport',
        quote: 'Water crosses by osmosis through channel proteins called aquaporins',
        focus: 'Membrane Transport',
        kind: 'concept',
        facts: ['aquaporins', 'uses ATP', 'endocytosis', 'a steeper concentration gradient'],
        prompts: ['Which channel proteins let water cross by osmosis?', 'What makes active transport different from diffusion?', 'How do large particles enter a cell?', 'What speeds up the rate of diffusion?'],
    },
    {
        title: 'Cell Division',
        quote: 'Mitosis produces two identical daughter cells for growth and repair',
        focus: 'Cell Division',
        kind: 'procedure',
        facts: ['two identical daughter cells', 'four genetically different gametes', 'the equator of the cell', 'spindle fibres'],
        prompts: ['What does mitosis produce?', 'What does meiosis produce?', 'Where do chromosomes line up in metaphase?', 'What pulls sister chromatids apart in anaphase?'],
    },
];

const LOOP_TOPICS = [
    {
        title: 'For Loops',
        quote: 'A for loop repeats a block of code once for each item in an iterable',
        focus: 'for loop repeats',
        kind: 'procedure',
        facts: ['a colon', 'four spaces', 'the numbers 0 to 9', 'total becomes 20'],
        prompts: ['What must end the line that starts a loop?', 'How far is a loop body indented?', 'Which numbers does range(10) produce?', 'What is the result of the even-number example?'],
    },
    {
        title: 'While Loops and Errors',
        quote: 'A while loop repeats as long as its condition stays true',
        focus: 'While loops',
        kind: 'procedure',
        facts: ['an infinite loop', 'break', 'a SyntaxError', 'an IndentationError'],
        prompts: ['What happens if a while condition never becomes false?', 'Which keyword leaves a loop early?', 'Which error does a missing colon raise?', 'Which error does mixing tabs and spaces raise?'],
    },
];

const DISTRACTORS = ['the plasma spindle', 'a lipid ribbon', 'the nuclear bridge'];

const lessonJson = (topic, { code = false } = {}) => ({
    lesson: {
        hook: `${topic.title} comes up in every test on this unit.`,
        sections: [
            { title: `What the notes say about ${topic.title}`, role: 'core', body: `The notes describe ${topic.facts.join(', ')}.`, sourceQuote: topic.quote },
            code
                ? {
                    title: 'Looping over a range',
                    role: 'example',
                    body: 'Count to nine:\n\n```python\nfor n in range(10):\n    print(n)\n```',
                    sourceQuote: 'The range(10) call produces the numbers 0 to 9.',
                }
                : null,
        ].filter(Boolean),
        recap: [{ prompt: `Name one fact about ${topic.title}.`, answer: topic.facts[0] }],
        wordBank: [{ term: topic.title, definition: 'the focus of this lesson' }],
    },
});

const questionsJson = (topic) => ({
    questions: topic.facts.map((fact, index) => ({
        prompt: topic.prompts[index],
        options: [fact, ...DISTRACTORS],
        correctIndex: 0,
        explanation: `The notes mention ${fact}.`,
        hint: 'Look back at the main paragraph.',
    })),
    inLessonChecks: [],
    ordering: null,
});

// The stub planner starts each topic at the first source part whose listing
// mentions the topic's focus.
const planJson = (topics, messages) => {
    const parts = String(messages?.[1]?.content || '')
        .split('\n')
        .map((line) => line.match(/^\[(\d+)\] (.*)$/))
        .filter(Boolean)
        .map((match) => ({ index: Number(match[1]), line: match[2].toLowerCase() }));
    return {
        lessons: topics.map(({ title, focus, kind }) => ({
            title,
            kind,
            firstPart: parts.find((part) => part.line.includes(focus.toLowerCase()))?.index ?? 0,
        })),
    };
};

const callKind = (messages) => {
    const system = String(messages?.[0]?.content || '');
    if (system.startsWith("You are ChewnPour's study curriculum planner.")) return 'plan';
    if (system.startsWith("You are ChewnPour's study lesson writer.")) return 'lesson';
    if (system.startsWith("You are ChewnPour's quiz writer.")) return 'questions';
    return 'unknown';
};

const titleOf = (messages) =>
    String(messages?.[1]?.content || '').match(/^Lesson title: (.+)$/m)?.[1] || '';

const sourceOf = (messages) =>
    String(messages?.[1]?.content || '').match(/\(untrusted data\):\n(`{3,})\n([\s\S]*)\n\1$/)?.[2] || '';

const ok = (body) => ({ text: JSON.stringify(body), provider: 'stub', model: 'stub-1' });

// A stub provider. onLesson / onQuestions decide each reply; they get the
// topic and how many times that call kind has been made for it.
const makeChat = ({ topics, onPlan, onLesson = (topic) => ok(lessonJson(topic)), onQuestions = (topic) => ok(questionsJson(topic)) }) => {
    const calls = [];
    const chat = async (args) => {
        const kind = callKind(args.messages);
        const title = kind === 'plan' ? '' : titleOf(args.messages);
        calls.push({
            kind,
            title,
            source: kind === 'lesson' ? sourceOf(args.messages) : '',
            signal: args.signal,
            run: args.run,
            maxTokens: args.maxTokens,
        });
        if (kind === 'plan') return onPlan ? onPlan() : ok(planJson(topics, args.messages));
        const topic = topics.find((entry) => entry.title === title);
        const attempt = calls.filter((call) => call.kind === kind && call.title === title).length;
        if (kind === 'lesson') return onLesson(topic, attempt);
        if (kind === 'questions') return onQuestions(topic, attempt);
        throw new Error(`stub: unexpected ${kind} call`);
    };
    return { chat, calls };
};

const readCourse = async (courseId) => {
    const course = (await db.query('SELECT * FROM courses WHERE id = $1', [courseId])).rows[0];
    const topics = (await db.query('SELECT * FROM topics WHERE course_id = $1 ORDER BY sort_order', [courseId])).rows;
    const questions = (await db.query('SELECT * FROM questions WHERE course_id = $1 ORDER BY sort_order', [courseId])).rows;
    return {
        status: course.status,
        backend: course.generation_backend,
        plan: course.lesson_plan,
        topics: topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            sortOrder: topic.sort_order,
            lesson: topic.lesson,
            grounding: topic.grounding,
            questions: questions
                .filter((question) => question.topic_id === topic.id)
                .map((question) => ({ prompt: question.prompt, surface: question.surface, questionType: question.question_type })),
        })),
    };
};

// Seeds an upload and its course, queues the course job and runs it once.
let seeded = 0;
const generate = async ({ fileName, extractedText, chat, ...options }) => {
    seeded += 1;
    const ids = await seedCourse(db, { id: String(seeded), extractedText, fileName });
    const queued = await enqueueGenerationJob({ courseId: ids.courseId, userId: ids.userId, uploadId: ids.uploadId });
    const job = await claimGenerationJob({ jobId: queued.id });
    const run = await runGenerationJob(job, { chat, aiEnabled: () => true, ...options });
    return { ...(await readCourse(ids.courseId)), run, ids, jobId: queued.id };
};
const jobRow = async (jobId) => (await db.query('SELECT * FROM generation_jobs WHERE id = $1', [jobId])).rows[0];
const truncated = () => {
    throw new LlmTruncatedError({ provider: 'stub', model: 'stub-1', usage: null });
};
const statusOf = (result, title) => result.plan.find((entry) => entry.title === title)?.status;

// Baseline: one plan call, then a lesson call and a quiz call per lesson.
{
    const { chat, calls } = makeChat({ topics: LOOP_TOPICS, onLesson: (topic) => ok(lessonJson(topic, { code: true })) });
    const result = await generate({ fileName: 'loops.pdf', extractedText: loopNotes, chat });
    assert.equal(result.backend, 'stub');
    assert.deepEqual(result.topics.map((topic) => topic.title), ['For Loops', 'While Loops and Errors']);
    assert.deepEqual(result.plan.map((entry) => entry.status), ['written', 'written']);
    const [forLoops, whileLoops] = result.topics;
    assert.ok(forLoops.lesson.sections[1].body.includes('```python\nfor n in range(10):\n    print(n)\n```'), 'code block survives generation intact');
    // The example quotes a sentence outside the while-loop span, so that
    // lesson drops it and says so.
    assert.deepEqual(whileLoops.lesson.sections.map((section) => section.role), ['core']);
    assert.deepEqual(whileLoops.grounding.droppedSections.map((section) => section.title), ['Looping over a range']);
    assert.equal(forLoops.grounding.droppedSections.length, 0);
    for (const topic of result.topics) {
        assert.equal(topic.questions.filter((question) => question.surface === 'quiz').length, 3, 'three quiz MCQs per topic');
        assert.equal(topic.questions.filter((question) => question.surface === 'exam').length, 1, 'remaining MCQs go to the exam');
    }
    const count = (kind) => calls.filter((call) => call.kind === kind).length;
    assert.deepEqual([count('plan'), count('lesson'), count('questions')], [1, 2, 2]);
    assert.ok(calls.filter((call) => call.kind === 'lesson').every((call) => call.maxTokens === 6000));
    assert.ok(calls.filter((call) => call.kind === 'questions').every((call) => call.maxTokens === 3000));
}

// H1 fixed: a truncated lesson is retried once with more room.
{
    const { chat, calls } = makeChat({
        topics: CELL_TOPICS,
        onLesson: (topic, attempt) => (topic.title === 'Cell Division' && attempt === 1 ? truncated() : ok(lessonJson(topic))),
    });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    const retries = calls.filter((call) => call.kind === 'lesson' && call.title === 'Cell Division');
    assert.deepEqual(retries.map((call) => [call.maxTokens, call.run.purpose]), [[6000, 'lesson'], [9600, 'lesson_retry']]);
    const division = result.topics.find((topic) => topic.title === 'Cell Division');
    assert.equal(division.lesson.sections[0].title, 'What the notes say about Cell Division', 'the retried lesson is the model\'s lesson');
    assert.equal(division.questions.filter((question) => question.surface === 'quiz').length, 3);
    assert.equal(statusOf(result, 'Cell Division'), 'written');
}

// A lesson that stays truncated is not written; its source text is never
// shipped as the lesson, and the other lessons are kept.
{
    const { chat } = makeChat({
        topics: CELL_TOPICS,
        onLesson: (topic) => (topic.title === 'Cell Division' ? truncated() : ok(lessonJson(topic))),
    });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    assert.deepEqual(result.topics.map((topic) => topic.title), ['Cell Structure', 'Membrane Transport']);
    assert.equal(statusOf(result, 'Cell Division'), 'failed');
    assert.match(result.plan.find((entry) => entry.title === 'Cell Division').error, /max_tokens/);
    assert.equal(result.backend, 'stub');
}

// A lesson call that throws: that lesson fails, the rest keep their quizzes.
{
    const { chat } = makeChat({
        topics: CELL_TOPICS,
        onLesson: (topic) => {
            if (topic.title === 'Membrane Transport') throw new Error('stub: provider 502');
            return ok(lessonJson(topic));
        },
    });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    assert.deepEqual(result.plan.map((entry) => entry.status), ['written', 'failed', 'written']);
    assert.ok(result.topics.every((topic) => topic.questions.length >= 3), 'healthy topics keep their questions');
}

// A failed quiz call keeps the lesson without a quiz; too few usable
// questions re-runs only the quiz call.
{
    const { chat, calls } = makeChat({
        topics: CELL_TOPICS,
        onQuestions: (topic, attempt) => {
            if (topic.title === 'Cell Structure') throw new Error('stub: provider 502');
            if (topic.title === 'Membrane Transport' && attempt === 1) return ok({ questions: [], inLessonChecks: [], ordering: null });
            return ok(questionsJson(topic));
        },
    });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    const byTitle = Object.fromEntries(result.topics.map((topic) => [topic.title, topic]));
    assert.equal(byTitle['Cell Structure'].questions.length, 0, 'the lesson is kept without a quiz');
    assert.equal(byTitle['Membrane Transport'].questions.filter((question) => question.surface === 'quiz').length, 3, 'the quiz call is re-run');
    const membraneCalls = calls.filter((call) => call.title === 'Membrane Transport');
    assert.deepEqual(membraneCalls.map((call) => call.run.purpose), ['lesson', 'lesson_questions', 'lesson_questions_retry'], 'only the quiz call is repeated');
    assert.deepEqual(result.plan.map((entry) => entry.status), ['written', 'written', 'written']);
}

// H4: the worker stops starting lessons at its time budget and puts the job
// back in the queue; lessons already written are kept, and the next worker
// writes the rest. Every call carries the job's context.
{
    const { chat, calls } = makeChat({ topics: CELL_TOPICS });
    let clock = 0;
    // Each clock read advances 10 s; the budget allows the first lessons only.
    const now = () => (clock += 10_000);
    const first = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat, startBudgetMs: 25_000, now });
    assert.equal(first.run.status, 'requeued');
    assert.ok(first.topics.length >= 1 && first.topics.length < 3, 'some lessons are written before the budget');
    assert.equal(first.status, 'generating', 'the course is still being written');
    assert.equal((await jobRow(first.jobId)).status, 'queued');
    assert.ok(first.plan.some((entry) => entry.status === 'pending'));

    const resumed = await claimGenerationJob({ jobId: first.jobId });
    assert.equal(resumed.attempts, 2);
    const second = await runGenerationJob(resumed, { chat, aiEnabled: () => true });
    assert.equal(second.status, 'done');
    const after = await readCourse(first.ids.courseId);
    assert.equal(after.status, 'ready');
    assert.deepEqual(after.topics.map((topic) => topic.title), CELL_TOPICS.map((topic) => topic.title), 'lessons are in document order');
    assert.deepEqual(after.topics.map((topic) => topic.sortOrder), [0, 1, 2]);
    assert.equal(after.topics[0].id, first.topics[0].id, 'lessons from the first worker are kept');
    assert.deepEqual(after.plan.map((entry) => entry.status), ['written', 'written', 'written']);
    assert.deepEqual(after.plan.map((entry) => entry.topicId), after.topics.map((topic) => topic.id));
    assert.equal(calls.filter((call) => call.kind === 'lesson').length, 3, 'no lesson is written twice');
    assert.equal((await jobRow(first.jobId)).status, 'done');

    const context = { courseId: first.ids.courseId, uploadId: first.ids.uploadId, userId: first.ids.userId };
    assert.deepEqual(calls.find((call) => call.kind === 'plan').run, { ...context, purpose: 'lesson_plan' });
    assert.deepEqual(calls.find((call) => call.kind === 'lesson' && call.title === 'Cell Division').run, { ...context, purpose: 'lesson', label: 'Cell Division' });
}

// A worker killed mid-job: its lease runs out and the next claim resumes the
// job without redoing the lessons it saved.
{
    const { chat, calls } = makeChat({ topics: CELL_TOPICS });
    let clock = 0;
    const killed = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat, startBudgetMs: 15_000, now: () => (clock += 10_000) });
    const written = killed.topics.length;
    // Pretend the worker died while running instead of requeueing.
    await db.query(`UPDATE generation_jobs SET status = 'running', locked_until = NOW() - INTERVAL '1 second' WHERE id = $1`, [killed.jobId]);
    assert.equal(await claimGenerationJob({ jobId: killed.jobId }).then(Boolean), true, 'an expired lease can be claimed');
    await db.query(`UPDATE generation_jobs SET locked_until = NOW() + INTERVAL '90 seconds' WHERE id = $1`, [killed.jobId]);
    assert.equal(await claimGenerationJob({ jobId: killed.jobId }), null, 'a live lease cannot');
    const job = await jobRow(killed.jobId);
    await db.query(`UPDATE generation_jobs SET locked_until = NOW() - INTERVAL '1 second' WHERE id = $1`, [killed.jobId]);
    const reclaimed = await claimGenerationJob();
    assert.equal(reclaimed.id, job.id, 'the oldest due job is claimed when none is named');
    await runGenerationJob(reclaimed, { chat, aiEnabled: () => true });
    const after = await readCourse(killed.ids.courseId);
    assert.equal(after.topics.length, 3);
    assert.equal(calls.filter((call) => call.kind === 'lesson').length, 3, `the ${written} saved lesson(s) are not rewritten`);
}

// H3 fixed: every provider fails. The plan falls back to headings, every
// lesson fails with its error recorded, and the course is marked failed so
// it can be regenerated; no stand-in lessons are shipped.
{
    const providersDown = () => {
        throw new Error('Course LLM providers failed: grid 500 | deepseek 500');
    };
    const { chat } = makeChat({ topics: CELL_TOPICS, onPlan: providersDown, onLesson: providersDown, onQuestions: providersDown });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    assert.equal(result.run.status, 'done');
    assert.equal(result.status, 'failed');
    assert.equal(result.topics.length, 0);
    assert.ok(result.plan.length > 0 && result.plan.every((entry) => entry.status === 'failed'));
    assert.ok(result.plan.every((entry) => /providers failed/.test(entry.error)));
}

// M1 fixed: each lesson is written from its own chapter, never the contents list.
{
    const { chat, calls } = makeChat({ topics: CELL_TOPICS });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    const sourceFor = (title) => calls.find((call) => call.kind === 'lesson' && call.title === title).source;
    assert.match(sourceFor('Cell Division'), /^# 3\. Cell Division\n\nMitosis produces two identical daughter cells/);
    for (const topic of CELL_TOPICS) {
        assert.doesNotMatch(sourceFor(topic.title), /\.{4,}\s*\d/, `${topic.title} source has no contents lines`);
    }
    assert.doesNotMatch(sourceFor('Cell Structure'), /Mitosis produces/, 'lessons do not share source text');
    assert.deepEqual(result.plan.map((entry) => entry.title), CELL_TOPICS.map((topic) => topic.title));
    assert.equal(result.plan[0].start, 0);
    assert.equal(result.plan.at(-1).end, cellNotes.trim().length, 'the plan covers the whole source');
}

// M12 (generation side): text that is only page numbers makes no model call.
// Extraction (PR 5a) sends such uploads to OCR first.
{
    const { chat, calls } = makeChat({ topics: CELL_TOPICS });
    const result = await generate({ fileName: 'scan.pdf', extractedText: scannedPdfText, chat });
    assert.equal(calls.length, 0);
    assert.equal(result.backend, 'heuristic');
    assert.equal(result.status, 'ready');
    assert.match(result.topics[0].lesson.sections[0].body, /no extractable text was found/);
}

await db.end();
await scratch.drop();
console.log('course-generation-failure-modes: ok');
