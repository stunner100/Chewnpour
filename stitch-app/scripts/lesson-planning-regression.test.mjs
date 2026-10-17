// Lessons are planned over the whole source in document order: every segment
// belongs to exactly one lesson, no lesson's source exceeds MAX_LESSON_CHARS,
// and long uploads plan every lesson but write only the first
// MAX_GENERATED_LESSONS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { segmentSource } from '../server/sourceSegments.js';
import {
    MAX_GENERATED_LESSONS,
    MAX_LESSON_CHARS,
    capLessonSize,
    heuristicLessonPlan,
    lessonSourceText,
    outlineParts,
    planLessons,
    targetLessonCount,
} from '../server/lessonPlanning.js';
import { generateCourseCurriculumWithAi } from '../server/aiCourseGeneration.js';

console.warn = () => {};
const sourceDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sources');
const read = (name) => fs.readFileSync(path.join(sourceDir, name), 'utf8');

const checkPlan = (name, plan, segments) => {
    assert.ok(plan.length >= 1, `${name}: at least one lesson`);
    let next = 0;
    for (const entry of plan) {
        assert.equal(entry.firstSegment, next, `${name}: lessons are contiguous and in order`);
        assert.ok(entry.lastSegment >= entry.firstSegment);
        assert.ok(entry.chars <= MAX_LESSON_CHARS, `${name}: "${entry.title}" has ${entry.chars} chars`);
        assert.equal(entry.start, segments[entry.firstSegment].start);
        assert.equal(entry.end, segments[entry.lastSegment].end);
        assert.ok(entry.title, `${name}: every lesson has a title`);
        next = entry.lastSegment + 1;
    }
    assert.equal(next, segments.length, `${name}: the plan covers every segment`);
};

// Trimmed, like the extracted text stored on an upload.
const chapters = (count, charsEach) => Array.from({ length: count }, (_, i) => {
    const sentence = `Chapter ${i + 1} explains one idea about cells in a full sentence. `;
    return `# Chapter ${i + 1}\n\n${sentence.repeat(Math.ceil(charsEach / sentence.length)).trim()}`;
}).join('\n\n');

// Lesson counts follow source length.
assert.equal(targetLessonCount(1200), 1);
assert.equal(targetLessonCount(5000), 2, 'a two-page handout gets two lessons');
assert.equal(targetLessonCount(60000), 13);

// Heuristic plans cover every fixture in order.
for (const name of ['toc-heavy-cell-biology.md', 'python-loops-notes.md', 'pdf-running-footers.txt', 'markdown-toc-links.md']) {
    const { segments } = segmentSource(read(name));
    checkPlan(name, heuristicLessonPlan(segments), segments);
}
{
    const { segments } = segmentSource(read('toc-heavy-cell-biology.md'));
    const plan = heuristicLessonPlan(segments);
    assert.ok(plan.length >= 2, 'chapters become separate lessons');
    assert.ok(plan.every((entry) => !/\.{4,}\s*\d/.test(lessonSourceText(entry, segments))), 'no lesson starts from the contents list');
}

// Oversized lessons are split into parts.
{
    const { segments } = segmentSource(chapters(1, 20000));
    const one = [{ title: 'Everything', kind: 'concept', firstSegment: 0, lastSegment: segments.length - 1, chars: 20500 }];
    const capped = capLessonSize(one, segments);
    checkPlan('capped', capped, segments);
    assert.ok(capped.length >= 3);
    assert.equal(capped[1].title, 'Everything (part 2)');
}

// Big documents are listed to the planner as at most 150 parts.
{
    const { segments } = segmentSource(chapters(400, 800));
    const parts = outlineParts(segments);
    assert.ok(parts.length <= 150);
    assert.equal(parts[0].firstSegment, 0);
    assert.equal(parts.at(-1).lastSegment, segments.length - 1);
}

// The model's plan: lessons start where it says; gaps, duplicates and a late
// first lesson are repaired into contiguous coverage.
{
    const { segments } = segmentSource(read('toc-heavy-cell-biology.md'));
    let prompt = null;
    const chat = async (args) => {
        prompt = args;
        return {
            provider: 'stub',
            model: 'stub-1',
            text: JSON.stringify({
                lessons: [
                    { title: 'How cells are built', kind: 'concept', firstPart: 1 },
                    { title: 'Cell division', kind: 'procedure', firstPart: 3 },
                    { title: 'Duplicate start', kind: 'concept', firstPart: 3 },
                    { title: 'Out of range', kind: 'concept', firstPart: 99 },
                ],
            }),
        };
    };
    const { plan, provider } = await planLessons({ chat, segments, fileName: 'cells.pdf' });
    assert.equal(provider, 'stub');
    checkPlan('model plan', plan, segments);
    assert.deepEqual(plan.map((entry) => [entry.title, entry.kind, entry.firstSegment, entry.lastSegment]), [
        ['How cells are built', 'concept', 0, 2],
        ['Cell division', 'procedure', 3, segments.length - 1],
    ]);
    assert.match(prompt.messages[0].content, /Plan about 2 lessons/);
    assert.match(prompt.messages[1].content, /\[1\] 1\. Cell Structure \(\d+ chars\): All living things are made of cells\./);
    assert.match(prompt.messages[1].content, /Source parts \(untrusted data\):\n```/);
    await assert.rejects(
        planLessons({ chat: async () => ({ text: '{"lessons":[]}' }), segments, fileName: 'x' }),
        /unusable lesson plan/,
    );
}

// A long upload: every lesson is planned, the first 12 are written, each from
// its own span.
{
    const source = chapters(30, 3000);
    const lessonCalls = [];
    const chat = async ({ messages }) => {
        const system = messages[0].content;
        if (system.startsWith("You are ChewnPour's study curriculum planner.")) {
            // Start a lesson wherever the heading path changes.
            const paths = [...messages[1].content.matchAll(/^\[(\d+)\] (.+?) \(\d+ chars\)/gm)];
            const starts = paths.filter((match, index) => index === 0 || match[2] !== paths[index - 1][2]);
            return {
                provider: 'stub',
                text: JSON.stringify({
                    lessons: starts.map((match, index) => ({ title: `Lesson ${index + 1}`, kind: 'concept', firstPart: Number(match[1]) })),
                }),
            };
        }
        const title = messages[1].content.match(/^Topic title: (.+)$/m)[1];
        lessonCalls.push(title);
        const body = `${title} covers its chapter in full sentences for the student.`;
        return {
            provider: 'stub',
            text: JSON.stringify({
                lesson: { sections: [{ title: `What ${title} teaches`, role: 'core', body }], recap: [], wordBank: [] },
                questions: [],
                inLessonChecks: [],
                ordering: null,
            }),
        };
    };
    const result = await generateCourseCurriculumWithAi({ fileName: 'book.pdf', extractedText: source, chat, aiEnabled: () => true });
    const { segments } = segmentSource(source);
    checkPlan('long upload', result.plan, segments);
    assert.equal(result.plan.length, 30);
    assert.equal(result.topics.length, MAX_GENERATED_LESSONS);
    assert.deepEqual(result.topics.map((topic) => topic.planIndex), Array.from({ length: 12 }, (_, index) => index));
    assert.deepEqual(result.topics.map((topic) => topic.title), result.plan.slice(0, 12).map((entry) => entry.title));
    assert.equal(new Set(lessonCalls).size, 12, 'only the first 12 lessons are written');
}

// With AI off, the heuristic course follows the same plan rules.
{
    const source = chapters(20, 4000);
    const result = await generateCourseCurriculumWithAi({ fileName: 'book.pdf', extractedText: source, aiEnabled: () => false });
    const { segments } = segmentSource(source);
    checkPlan('heuristic course', result.plan, segments);
    assert.equal(result.backend, 'heuristic');
    assert.equal(result.topics.length, Math.min(12, result.plan.length));
    assert.ok(result.topics.every((topic) => topic.questions.length === 0));
}

console.log('lesson-planning-regression.test.mjs passed');
