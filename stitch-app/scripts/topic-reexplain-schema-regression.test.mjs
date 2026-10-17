// Re-explain rewrites section bodies and keeps the lesson's structure, so
// in-lesson checks (bound by section index) still apply; when the model's
// answer is unusable it fails instead of showing a fake "simplified" lesson.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteLessonForStyle } from '../server/topicExplain.js';
import { normalizeLesson } from '../src/lib/lessonSchema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lesson = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'lessons', 'structured-osmosis.json'), 'utf8'));

const reply = (sections) => async () => ({ text: JSON.stringify({ sections }), provider: 'stub' });
const simpler = lesson.sections.map((section, index) => ({
    body: index === 2
        ? 'Put a plant cell in pure water and it fills up. Its wall stops it bursting, even at -40 °C storage it keeps that shape.'
        : `Simply put: ${section.body}`,
}));

// The structure is kept; only bodies change.
{
    let prompt = null;
    const chat = async (args) => {
        prompt = args;
        return reply(simpler)();
    };
    const { lesson: rewritten, backend } = await rewriteLessonForStyle({ lesson, title: 'Osmosis', style: "Teach me like I'm 12", chat });
    assert.equal(backend, 'stub');
    assert.deepEqual(
        rewritten.sections.map((section) => [section.title, section.role, section.sourceQuote]),
        lesson.sections.map((section) => [section.title, section.role, section.sourceQuote]),
    );
    assert.deepEqual(rewritten.sections.map((section) => section.body), simpler.map((item) => item.body));
    assert.equal(rewritten.hook, lesson.hook);
    assert.deepEqual(rewritten.recap, lesson.recap);
    assert.deepEqual(rewritten.wordBank, lesson.wordBank);
    assert.match(rewritten.sections[2].body, /-40 °C/, 'minus signs survive');
    assert.ok(normalizeLesson(rewritten), 'the result is a valid lesson for the client');

    assert.equal(prompt.responseFormat, 'json_object');
    assert.match(prompt.messages[0].content, /exactly one entry per input section, in the same order/);
    assert.match(prompt.messages[0].content, /including signs and units such as -40 °C/);
    const sent = JSON.parse(prompt.messages[1].content.split('SECTIONS:\n')[1]);
    assert.deepEqual(sent.map((item) => item.title), lesson.sections.map((section) => section.title));
}

// Unusable answers fail with a status the route returns, never a fallback.
const failures = [
    ['one section missing', reply(simpler.slice(1))],
    ['an empty body', reply(simpler.map((item, index) => (index === 0 ? { body: '' } : item)))],
    ['truncated JSON', async () => ({ text: JSON.stringify({ sections: simpler }).slice(0, 200), provider: 'stub' })],
];
for (const [name, chat] of failures) {
    await assert.rejects(
        rewriteLessonForStyle({ lesson, title: 'Osmosis', style: 'Make it more concise', chat }),
        (error) => error.status === 502 && /couldn't re-explain/.test(error.message),
        name,
    );
}
await assert.rejects(
    rewriteLessonForStyle({ lesson: { sections: [] }, style: 'Make it more concise', chat: reply([]) }),
    (error) => error.status === 409,
);

const source = fs.readFileSync(path.join(root, 'server', 'topicExplain.js'), 'utf8');
assert.doesNotMatch(source, /stripMarkdownLikeFormatting|buildReExplainFallback/, 'no hyphen-stripping and no fake fallback lesson');

console.log('topic-reexplain-schema-regression.test.mjs passed');
