// Drives generateCourseCurriculumWithAi with a stubbed LLM to pin down what
// happens when generation goes wrong: truncated JSON, one topic failing, a
// stalled provider, every provider failing, and a table-of-contents source.
//
// Each knownBug() pins today's behavior. When a fix lands, replace it with a
// plain assertion of the fixed behavior (the `fixed` note says what that is).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCourseCurriculumWithAi } from '../server/aiCourseGeneration.js';

// The generator logs every failure it recovers from; these runs fail on purpose.
console.warn = () => {};

const sourceDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sources');
const readSource = (name) => fs.readFileSync(path.join(sourceDir, name), 'utf8');
const cellNotes = readSource('toc-heavy-cell-biology.md');
const loopNotes = readSource('python-loops-notes.md');
const scannedPdfText = readSource('scanned-page-numbers.txt');

const knownBug = (id, actual, expected, fixed) => {
    assert.deepEqual(
        actual,
        expected,
        `Known bug ${id} no longer reproduces. If this was fixed on purpose, replace this knownBug() with an assertion that ${fixed}.`,
    );
};

const CELL_TOPICS = [
    {
        title: 'Cell Structure',
        focus: 'Cell Structure',
        kind: 'concept',
        facts: ['the nucleoid', 'the Golgi apparatus', 'a cell wall made of cellulose', 'Lysosomes'],
        prompts: ['Where does a prokaryote keep its DNA?', 'Which organelle packages proteins into vesicles?', 'What do plant cells have that animal cells lack?', 'Which structures digest worn-out organelles?'],
    },
    {
        title: 'Membrane Transport',
        focus: 'Membrane Transport',
        kind: 'concept',
        facts: ['aquaporins', 'uses ATP', 'endocytosis', 'a steeper concentration gradient'],
        prompts: ['Which channel proteins let water cross by osmosis?', 'What makes active transport different from diffusion?', 'How do large particles enter a cell?', 'What speeds up the rate of diffusion?'],
    },
    {
        title: 'Cell Division',
        focus: 'Cell Division',
        kind: 'procedure',
        facts: ['two identical daughter cells', 'four genetically different gametes', 'the equator of the cell', 'spindle fibres'],
        prompts: ['What does mitosis produce?', 'What does meiosis produce?', 'Where do chromosomes line up in metaphase?', 'What pulls sister chromatids apart in anaphase?'],
    },
];

const LOOP_TOPICS = [
    {
        title: 'For Loops',
        focus: 'for loop repeats',
        kind: 'procedure',
        facts: ['a colon', 'four spaces', 'the numbers 0 to 9', 'total becomes 20'],
        prompts: ['What must end the line that starts a loop?', 'How far is a loop body indented?', 'Which numbers does range(10) produce?', 'What is the result of the even-number example?'],
    },
    {
        title: 'While Loops and Errors',
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
            { title: `What the notes say about ${topic.title}`, role: 'core', body: `The notes describe ${topic.facts.join(', ')}.` },
            code
                ? { title: 'Looping over a range', role: 'example', body: 'Count to nine:\n\n```python\nfor n in range(10):\n    print(n)\n```' }
                : null,
        ].filter(Boolean),
        recap: [{ prompt: `Name one fact about ${topic.title}.`, answer: topic.facts[0] }],
        wordBank: [{ term: topic.title, definition: 'the focus of this lesson' }],
    },
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

const outlineJson = (topics) => ({
    topics: topics.map(({ title, focus, kind }) => ({
        title,
        description: `What the notes say about ${title.toLowerCase()}.`,
        focus,
        kind,
    })),
});

const callKind = (messages) => {
    const system = String(messages?.[0]?.content || '');
    if (system.startsWith("You are ChewnPour's study curriculum planner.")) return 'outline';
    if (system.startsWith("You are ChewnPour's study lesson writer.")) return 'topic';
    if (system.startsWith("You are ChewnPour's study curriculum generator.")) return 'single_pass';
    return 'unknown';
};

const topicTitleOf = (messages) =>
    String(messages?.[1]?.content || '').match(/^Topic title: (.+)$/m)?.[1] || '';

const snippetOf = (messages) =>
    String(messages?.[1]?.content || '').split('```')[1]?.trim() || '';

// A stub provider. `onTopic` decides what each per-topic call returns.
const makeChat = ({ topics, onTopic, onOutline }) => {
    const calls = [];
    const chat = async (args) => {
        const kind = callKind(args.messages);
        const title = kind === 'topic' ? topicTitleOf(args.messages) : '';
        calls.push({
            kind,
            title,
            snippet: kind === 'topic' ? snippetOf(args.messages) : '',
            hasSignal: Boolean(args.signal),
            maxTokens: args.maxTokens,
        });
        if (kind === 'outline') {
            if (onOutline) return onOutline();
            return { text: JSON.stringify(outlineJson(topics)), provider: 'stub', model: 'stub-1' };
        }
        if (kind === 'topic') {
            const topic = topics.find((entry) => entry.title === title);
            return onTopic(topic, calls.filter((call) => call.kind === 'topic' && call.title === title).length);
        }
        throw new Error(`stub: unexpected ${kind} call`);
    };
    return { chat, calls };
};

const ok = (topic, options) => ({ text: JSON.stringify(lessonJson(topic, options)), provider: 'stub', model: 'stub-1' });
const generate = (args) => generateCourseCurriculumWithAi({ aiEnabled: () => true, ...args });

// Baseline: a clean run keeps every topic, its markdown and its grounded MCQs.
{
    const { chat, calls } = makeChat({ topics: LOOP_TOPICS, onTopic: (topic) => ok(topic, { code: true }) });
    const result = await generate({ fileName: 'loops.pdf', extractedText: loopNotes, chat });
    assert.equal(result.backend, 'stub');
    assert.deepEqual(result.topics.map((topic) => topic.title), ['For Loops', 'While Loops and Errors']);
    for (const topic of result.topics) {
        assert.equal(topic.lesson.sections.length, 2, 'both sections are kept');
        assert.ok(topic.lesson.sections[1].body.includes('```python\nfor n in range(10):\n    print(n)\n```'), 'code block survives generation intact');
        assert.equal(topic.lesson.sections[1].role, 'example');
        assert.equal(topic.questions.filter((question) => question.surface === 'quiz').length, 3, 'three quiz MCQs per topic');
        assert.equal(topic.questions.filter((question) => question.surface === 'exam').length, 1, 'remaining MCQs go to the exam');
    }
    assert.deepEqual(calls.map((call) => call.kind), ['outline', 'topic', 'topic'], 'one outline call and one call per topic');
    assert.ok(calls.every((call) => call.kind !== 'topic' || call.maxTokens === 4096), 'topic calls ask for 4,096 tokens');
}

// H1: truncated JSON from the lesson writer ships the raw source snippet as the lesson.
{
    const truncate = (topic) => {
        const full = JSON.stringify(lessonJson(topic));
        return { text: full.slice(0, Math.floor(full.length * 0.6)), provider: 'stub', model: 'stub-1' };
    };
    const { chat, calls } = makeChat({ topics: CELL_TOPICS, onTopic: truncate });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    const topicCalls = calls.filter((call) => call.kind === 'topic');
    knownBug(
        'H1 (truncation ships raw text)',
        result.topics.map((topic) => ({
            rawSnippet: topic.lesson.sections.length === 1
                && topic.lesson.sections[0].body === topicCalls.find((call) => call.title === topic.title).snippet,
            questions: topic.questions.length,
        })),
        CELL_TOPICS.map(() => ({ rawSnippet: true, questions: 0 })),
        'a truncated response is retried with a larger budget, and a topic that still fails is flagged instead of shipping the raw snippet',
    );
    knownBug(
        'H1 (fallback reported as AI)',
        result.backend,
        'stub',
        'the course records that its topics are raw excerpts, not AI lessons',
    );
    assert.equal(topicCalls.length, CELL_TOPICS.length * 2, 'each topic is attempted once, then once more by the serial question regen');
}

// One topic throws every time; the others succeed.
{
    const { chat } = makeChat({
        topics: CELL_TOPICS,
        onTopic: (topic) => {
            if (topic.title === 'Membrane Transport') throw new Error('stub: provider 502');
            return ok(topic);
        },
    });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    const failed = result.topics.find((topic) => topic.title === 'Membrane Transport');
    assert.equal(result.topics.length, 3, 'the other topics are kept');
    knownBug(
        'H1 (failed topic ships raw text, unflagged)',
        { sections: failed.lesson.sections.length, questions: failed.questions.length, flagged: 'status' in failed },
        { sections: 1, questions: 0, flagged: false },
        'the failed topic carries a failed status the UI can show, with a Regenerate action',
    );
    assert.ok(
        result.topics.filter((topic) => topic !== failed).every((topic) => topic.questions.length >= 3),
        'healthy topics keep their questions',
    );
}

// H4: one topic stalls past the course deadline.
{
    const { chat, calls } = makeChat({
        topics: CELL_TOPICS,
        onTopic: (topic) => (topic.title === 'Cell Division' ? new Promise(() => {}) : ok(topic)),
    });
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat, timeoutMs: 1000 });
    knownBug(
        'H4 (deadline discards finished topics)',
        { backend: result.backend, aiQuestions: result.topics.reduce((sum, topic) => sum + topic.questions.length, 0) },
        { backend: 'heuristic_timeout', aiQuestions: 0 },
        'the two finished topics are kept with their questions and only Cell Division is flagged',
    );
    knownBug(
        'H4 (no abort signal)',
        calls.some((call) => call.hasSignal),
        false,
        'LLM calls receive an AbortSignal so a stalled request is cancelled at the deadline',
    );
}

// Every provider fails: the heuristic fallback becomes the course, with no quiz.
{
    const { chat } = makeChat({
        topics: CELL_TOPICS,
        onOutline: () => {
            throw new Error('Course LLM providers failed: grid 500 | deepseek 500');
        },
        onTopic: () => {
            throw new Error('unreachable');
        },
    });
    const singlePassChat = async (args) => {
        if (callKind(args.messages) === 'single_pass') throw new Error('Course LLM providers failed: grid 500 | deepseek 500');
        return chat(args);
    };
    const result = await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat: singlePassChat });
    assert.equal(result.backend, 'heuristic_fallback');
    assert.ok(result.topics.length >= 1);
    assert.ok(result.topics.every((topic) => topic.questions.length === 0), 'heuristic topics have no quiz');
    knownBug(
        'H3 (heuristic fallback is final)',
        'status' in result.topics[0],
        false,
        'heuristic topics are marked so the course can be regenerated when providers recover',
    );
}

// M1: the topic snippet comes from the first match of the title, here the table of contents.
{
    const { chat, calls } = makeChat({ topics: CELL_TOPICS, onTopic: (topic) => ok(topic) });
    await generate({ fileName: 'cells.pdf', extractedText: cellNotes, chat });
    const divisionSnippet = calls.find((call) => call.kind === 'topic' && call.title === 'Cell Division').snippet;
    knownBug(
        'M1 (snippet taken from the table of contents)',
        {
            startsAtContents: divisionSnippet.includes('Contents\n1. Cell Structure ....'),
            hasChapterBody: divisionSnippet.includes('Mitosis produces two identical daughter cells'),
        },
        { startsAtContents: true, hasChapterBody: false },
        'the Cell Division lesson is written from chapter 3, not from the contents list',
    );
}

// M12: a scanned PDF whose text layer is only page numbers still goes to the LLM.
{
    const { chat, calls } = makeChat({ topics: CELL_TOPICS, onTopic: (topic) => ok(topic) });
    await generate({ fileName: 'scan.pdf', extractedText: scannedPdfText, chat });
    knownBug(
        'M12 (no minimum-text gate)',
        calls.length > 0,
        true,
        'text that is only page numbers is sent to OCR before any course generation call',
    );
}

console.log('course-generation-failure-modes: ok');
