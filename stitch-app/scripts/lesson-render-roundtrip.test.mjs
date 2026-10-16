// Runs realistic lessons (scripts/fixtures/lessons) through the production
// path: markdown -> stored lesson (lessonFromMarkdown, as the topic-lesson
// migration converts old lessons) -> the topic page's view (buildLessonView),
// then renders section bodies with the real LessonContentRenderer.
//
// knownBug() pins behavior that is still wrong so a fix shows up as a failing
// assertion. When a fix lands, replace that knownBug() with a plain assertion
// of the fixed behavior (the `fixed` note says what that is).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { buildLessonView, checksWithSectionTitles } from '../src/lib/lessonView.js';
import { lessonFromMarkdown, lessonToMarkdown } from '../src/lib/lessonSchema.js';
import { markdownToSpeechText } from '../src/lib/lessonMarkdown.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'scripts', 'fixtures', 'lessons');
const fixtures = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'index.json'), 'utf8'));

// Load the real renderer: transpile its JSX once into node_modules/.cache.
const loadRenderer = async () => {
    const file = path.join(root, 'src', 'components', 'LessonContentRenderer.jsx');
    const { code } = await transformWithEsbuild(fs.readFileSync(file, 'utf8'), file, { loader: 'jsx', jsx: 'automatic' });
    const out = path.join(root, 'node_modules', '.cache', 'lesson-render-roundtrip', 'LessonContentRenderer.mjs');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, code);
    return (await import(pathToFileURL(out).href)).default;
};
const LessonContentRenderer = await loadRenderer();
const renderHtml = (markdown) => renderToStaticMarkup(React.createElement(LessonContentRenderer, { markdown }));

const render = (fixture, studyMode = 'full') => {
    const lesson = lessonFromMarkdown(fs.readFileSync(path.join(fixtureDir, fixture.file), 'utf8'), { topicTitle: fixture.title });
    return buildLessonView({
        content: lessonToMarkdown(lesson),
        topicTitle: fixture.title,
        checks: checksWithSectionTitles(fixture.checks, lesson),
        studyMode,
        wordBank: lesson.wordBank,
    });
};

const byKind = Object.fromEntries(fixtures.map((fixture) => [fixture.kind, fixture]));
const titles = (steps) => steps.map((step) => step.title);
const stepNamed = (steps, title) => steps.find((step) => step.title === title);
const allHtml = (steps) => steps.map((step) => renderHtml(step.markdown)).join('\n');

const knownBug = (id, actual, expected, fixed) => {
    assert.deepEqual(
        actual,
        expected,
        `Known bug ${id} no longer reproduces. If this was fixed on purpose, replace this knownBug() with an assertion that ${fixed}.`,
    );
};

// Invariants for every fixture.
for (const fixture of fixtures) {
    const { steps, readingMinutes, wordBankTerms } = render(fixture);
    assert.ok(steps.length >= 6, `${fixture.kind}: expected at least 6 steps, got ${steps.length}`);
    assert.equal(steps[0].title, 'Why This Matters', `${fixture.kind}: first step follows the lesson's first H2`);
    assert.ok(readingMinutes >= 1, `${fixture.kind}: reading time must be at least a minute`);
    assert.ok(wordBankTerms.length >= 3, `${fixture.kind}: Word Bank terms are parsed`);
    assert.equal(steps.at(-1).type, 'wordbank', `${fixture.kind}: the Word Bank is the last step`);
    assert.equal(
        steps.filter((step) => step.check).length,
        fixture.checks.length,
        `${fixture.kind}: every check binds to its section`,
    );
    for (const step of steps.filter((entry) => entry.type === 'section')) {
        assert.ok(step.markdown.trim(), `${fixture.kind}: "${step.title}" has a body`);
        assert.doesNotMatch(renderHtml(step.markdown), /<h[12][\s>]/, `${fixture.kind}: section bodies never render h1/h2`);
    }
}

// Concept lesson: sub-headings, tables, sentences that start like a section title.
{
    const { steps, wordBankTerms } = render(byKind.concept);
    assert.deepEqual(titles(steps), [
        'Why This Matters',
        'Key Terms to Know First',
        'The Idea',
        'Examples and Non-Examples',
        'The Attractive Wrong Idea',
        'Use It',
        'Recap from Memory',
        'Word Bank',
    ]);
    const ideaHtml = renderHtml(stepNamed(steps, 'The Idea').markdown);
    assert.match(ideaHtml, /<h3>Size comparison<\/h3>/, 'the H3 stays inside The Idea as an h3');
    assert.match(ideaHtml, /<div class="lesson-table-scroll"><table>/, 'the table renders as a scrollable table');
    assert.equal((ideaHtml.match(/<tr>/g) || []).length, 3, 'header row plus two body rows');
    assert.match(ideaHtml, /if r &gt; 10 um, diffusion alone/, 'r > 10 stays in its sentence');
    const wrongIdeaHtml = renderHtml(stepNamed(steps, 'The Attractive Wrong Idea').markdown);
    assert.doesNotMatch(wrongIdeaHtml, /<h[34]/, '"The idea is that…" stays a sentence');
    assert.deepEqual(wordBankTerms.map((entry) => entry.term), ['Prokaryote', 'Eukaryote', 'Nucleoid', 'Organelle']);
    assert.equal(wordBankTerms[2].definition, 'the region of a prokaryote that holds its DNA');
}

// Procedure lesson: code blocks, comparisons, decorators.
{
    const { steps } = render(byKind.procedure);
    assert.deepEqual(titles(steps), [
        'Why This Matters',
        'Key Terms to Know First',
        'The Steps',
        'Worked Example',
        'Traps and Mistakes',
        'Use It',
        'Recap from Memory',
        'Word Bank',
    ]);
    const exampleHtml = renderHtml(stepNamed(steps, 'Worked Example').markdown);
    assert.match(
        exampleHtml,
        /<pre><code class="language-python">total = 0\nfor n in range\(10\):\n {4}if n % 2 == 0:\n {8}total \+= n\nprint\(total\) {2}# 20\n<\/code><\/pre>/,
        'the worked example is one code block with indentation and its # comment intact',
    );
    assert.match(exampleHtml, /total grows 0 -&gt; 2 -&gt; 6 -&gt; 12 -&gt; 20\./, 'the arrow chain stays in its sentence');
    const trapsHtml = renderHtml(stepNamed(steps, 'Traps and Mistakes').markdown);
    assert.match(trapsHtml, /<li>Decorators such as @staticmethod go above a method/, 'the @staticmethod bullet renders');
    assert.equal((renderHtml(stepNamed(steps, 'The Steps').markdown).match(/<li>/g) || []).length, 4, 'four numbered steps');
    assert.match(renderHtml(stepNamed(steps, 'Use It').markdown), /len\(word\) &gt; 5/, 'len(word) > 5 stays inline');
    assert.doesNotMatch(
        markdownToSpeechText(stepNamed(steps, 'Worked Example').markdown),
        /print\(total\)/,
        'read-aloud skips code blocks',
    );
}

// Narrative lesson: arrow chains and section order.
{
    const { steps } = render(byKind.narrative);
    assert.deepEqual(titles(steps), [
        'Why This Matters',
        'Key Terms to Know First',
        'Who and When',
        'Causal Chain',
        'A Sourced Episode',
        'Competing Accounts',
        'What Changed After',
        'Word Bank',
    ]);
    assert.equal(stepNamed(steps, 'Causal Chain').check?.id, 'check-narrative-chain');
    const chainHtml = renderHtml(stepNamed(steps, 'Causal Chain').markdown);
    assert.doesNotMatch(chainHtml, /<blockquote>/, 'arrows never become quotes');
    assert.match(chainHtml, /^<div class="lesson-markdown"><p>Post-war economic grievances -&gt; the 1948 Accra riots -&gt;/);
}

// Argument lesson: inequalities, minus signs in read-aloud.
{
    const { steps } = render(byKind.argument);
    const counterHtml = renderHtml(stepNamed(steps, 'The Counterargument').markdown);
    assert.match(counterHtml, /if the wage floor w &gt; the market wage, employers hire fewer workers/);
    assert.doesNotMatch(allHtml(steps), /<blockquote>/);
    assert.equal(stepNamed(steps, 'Evidence from the Source').check?.id, 'check-argument-evidence');
}

// Renderer safety: no raw HTML, only http(s) links, images as alt text.
{
    const html = renderHtml('<b>raw</b> [bad](javascript:alert(1)) [ok](https://example.org) ![a diagram](https://x.org/a.png)');
    assert.doesNotMatch(html, /<b>|javascript:|<img/);
    assert.match(html, /<span>bad<\/span>/);
    assert.match(html, /<a href="https:\/\/example.org" target="_blank" rel="noopener noreferrer">ok<\/a>/);
    assert.match(html, /<span>a diagram<\/span>/);
}

// Read-aloud keeps minus signs and hyphens.
assert.equal(markdownToSpeechText('It froze at **-40 °C** in a well-known case.'), 'It froze at -40 °C in a well-known case.');

// A lesson that repeats the page title as an H1 drops that heading.
{
    const view = buildLessonView({
        content: '# Cells\n\nCells are the unit of life and every organism has them.\n\n## The Idea\n\nCells have parts that do different jobs.',
        topicTitle: 'Cells',
    });
    assert.deepEqual(titles(view.steps), ['Introduction', 'The Idea']);
}

// Study modes still filter on section names the lesson spines never use (Phase 2.2).
for (const fixture of fixtures) {
    knownBug(
        `study modes (${fixture.kind})`,
        titles(render(fixture, 'quick_revision').steps),
        ['Word Bank'],
        `Quick revision shows the core sections of the ${fixture.kind} lesson, not only the Word Bank`,
    );
}

console.log(`lesson-render-roundtrip: ok (${fixtures.length} fixtures)`);
