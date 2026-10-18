// Runs the fixture lessons (scripts/fixtures/lessons) through the lesson
// page's pipeline (buildLessonView) and server-renders the real lesson
// components to check what students see.
//
// Markdown fixtures go through lessonFromMarkdown first, the way the
// topic-lesson migration converted old lessons; JSON fixtures are lessons as
// generation writes them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildLessonView, SECTION_ROLE_LABELS } from '../src/lib/lessonView.js';
import { markdownToSpeechText } from '../src/lib/lessonMarkdown.js';
import { lessonFromMarkdown } from '../src/lib/lessonSchema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'scripts', 'fixtures', 'lessons');
const fixtures = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'index.json'), 'utf8'));

// Bundle the real components (their own imports included, packages left
// external) into node_modules/.cache and load them.
const loadComponent = async (relativePath) => {
    const outfile = path.join(root, 'node_modules', '.cache', 'lesson-render-roundtrip', `${path.basename(relativePath, '.jsx')}.mjs`);
    await build({
        entryPoints: [path.join(root, relativePath)],
        outfile,
        bundle: true,
        format: 'esm',
        platform: 'node',
        jsx: 'automatic',
        packages: 'external',
        logLevel: 'silent',
    });
    return (await import(pathToFileURL(outfile).href)).default;
};
const LessonContentRenderer = await loadComponent('src/components/LessonContentRenderer.jsx');
const LessonSectionHeading = await loadComponent('src/components/lesson/LessonSectionHeading.jsx');
const LessonRecapCards = await loadComponent('src/components/lesson/LessonRecapCards.jsx');
const html = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const renderBody = (markdown) => html(LessonContentRenderer, { markdown });

const lessonOf = (fixture) => (fixture.lessonFile
    ? JSON.parse(fs.readFileSync(path.join(fixtureDir, fixture.lessonFile), 'utf8'))
    : lessonFromMarkdown(fs.readFileSync(path.join(fixtureDir, fixture.file), 'utf8'), { topicTitle: fixture.title }));
const render = (fixture, studyMode = 'full') => buildLessonView({ lesson: lessonOf(fixture), checks: fixture.checks, studyMode });

const byKind = Object.fromEntries(fixtures.map((fixture) => [fixture.kind, fixture]));
const titles = (steps) => steps.map((step) => step.title);
const stepNamed = (steps, title) => steps.find((step) => step.title === title);
const sectionSteps = (steps) => steps.filter((step) => step.type === 'section');

// Invariants for every fixture.
for (const fixture of fixtures) {
    const lesson = lessonOf(fixture);
    const { steps, readingMinutes, wordBankTerms } = render(fixture);
    assert.deepEqual(
        sectionSteps(steps).map((step) => [step.title, step.role]),
        lesson.sections.map((section) => [section.title, section.role]),
        `${fixture.kind}: one step per section, in order, with its role`,
    );
    assert.equal(steps.length, lesson.sections.length + (lesson.recap.length ? 1 : 0) + (lesson.wordBank.length ? 1 : 0));
    assert.equal(steps.at(-1).type, 'wordbank', `${fixture.kind}: the Word Bank is the last step`);
    assert.equal(wordBankTerms.length, lesson.wordBank.length);
    assert.ok(readingMinutes >= 1);
    assert.deepEqual(
        steps.filter((step) => step.check).map((step) => [step.sectionIndex, step.check.id]),
        fixture.checks.map((check) => [check.sectionIndex, check.id]),
        `${fixture.kind}: every check sits on the section its index names`,
    );
    for (const step of sectionSteps(steps)) {
        assert.doesNotMatch(renderBody(step.markdown), /<h[12][\s>]/, `${fixture.kind}: section bodies never render h1/h2`);
    }
    // Study modes filter by role and never come up empty.
    const quick = render(fixture, 'quick_revision').steps;
    assert.ok(sectionSteps(quick).length >= 1, `${fixture.kind}: Quick revision shows sections`);
    assert.ok(sectionSteps(quick).every((step) => step.role === 'core'));
    const examPrep = render(fixture, 'exam_prep').steps;
    assert.ok(sectionSteps(examPrep).every((step) => ['core', 'misconception', 'practice'].includes(step.role)));
    const practice = render(fixture, 'practice_only').steps;
    assert.ok(sectionSteps(practice).every((step) => step.check), `${fixture.kind}: Practice only keeps sections with checks`);
}

// Structured lesson: roles, hook, recap and Word Bank.
{
    const { steps, hook, wordBankTerms } = render(byKind.structured);
    assert.deepEqual(steps.map((step) => [step.type, step.role || null, step.title]), [
        ['section', 'core', 'How water moves across a membrane'],
        ['section', 'steps', 'Predicting the direction of osmosis'],
        ['section', 'example', 'A plant cell in pure water'],
        ['section', 'misconception', 'Osmosis is not the diffusion of solutes'],
        ['section', 'practice', 'Try it: potato strips in salt water'],
        ['recap', null, 'Recap'],
        ['wordbank', null, 'Word Bank'],
    ]);
    assert.match(hook, /cucumber goes limp/);
    assert.equal(stepNamed(steps, 'Recap').items.length, 3);
    assert.deepEqual(wordBankTerms.map((entry) => entry.term), ['Osmosis', 'Water potential', 'Turgid', 'Aquaporin']);
    assert.deepEqual(
        titles(render(byKind.structured, 'quick_revision').steps),
        ['How water moves across a membrane', 'Recap', 'Word Bank'],
    );
    assert.deepEqual(
        titles(render(byKind.structured, 'exam_prep').steps),
        ['How water moves across a membrane', 'Osmosis is not the diffusion of solutes', 'Try it: potato strips in salt water', 'Recap', 'Word Bank'],
    );
    assert.deepEqual(
        titles(render(byKind.structured, 'practice_only').steps),
        ['Predicting the direction of osmosis', 'Osmosis is not the diffusion of solutes', 'Recap', 'Word Bank'],
    );
    assert.match(renderBody(stepNamed(steps, 'Predicting the direction of osmosis').markdown), /<ol>\n<li>Compare the solute/);
}

// Role labels: core sections have none; every other role shows its label.
assert.doesNotMatch(html(LessonSectionHeading, { id: 'h', title: 'How water moves', role: 'core' }), /lesson-role-label/);
for (const [role, { label }] of Object.entries(SECTION_ROLE_LABELS)) {
    const heading = html(LessonSectionHeading, { id: 'h', title: 'A section', role });
    assert.match(heading, new RegExp(`<p class="lesson-role-label lesson-role-${role}">.*${label}</p><h2 id="h"`), `${role} label renders above the title`);
}

// Recap cards: prompts visible, answers hidden until revealed.
{
    const cards = html(LessonRecapCards, { items: [{ prompt: 'What moves during osmosis?', answer: 'Water.' }] });
    assert.match(cards, /<p class="lesson-recap-prompt">What moves during osmosis\?<\/p>/);
    assert.match(cards, /aria-expanded="false" aria-controls="recap-answer-0"/);
    assert.match(cards, /<p id="recap-answer-0" class="lesson-recap-answer" hidden="">Water\.<\/p>/);
}

// Converted lessons keep their content: tables, code, comparisons, @ lines.
{
    const concept = render(byKind.concept).steps;
    const ideaHtml = renderBody(stepNamed(concept, 'The Idea').markdown);
    assert.match(ideaHtml, /<h3>Size comparison<\/h3>/);
    assert.match(ideaHtml, /<div class="lesson-table-scroll"><table>/);
    assert.match(ideaHtml, /if r &gt; 10 um, diffusion alone/);
    assert.equal(stepNamed(concept, 'The Attractive Wrong Idea').role, 'misconception');

    const procedure = render(byKind.procedure).steps;
    assert.match(
        renderBody(stepNamed(procedure, 'Worked Example').markdown),
        /<pre><code class="language-python">total = 0\nfor n in range\(10\):\n {4}if n % 2 == 0:\n {8}total \+= n\nprint\(total\) {2}# 20\n<\/code><\/pre>/,
    );
    assert.match(renderBody(stepNamed(procedure, 'Traps and Mistakes').markdown), /<li>Decorators such as @staticmethod go above a method/);
    assert.doesNotMatch(markdownToSpeechText(stepNamed(procedure, 'Worked Example').markdown), /print\(total\)/, 'read-aloud skips code');

    const narrative = render(byKind.narrative).steps;
    assert.doesNotMatch(renderBody(stepNamed(narrative, 'Causal Chain').markdown), /<blockquote>/);
    assert.match(renderBody(stepNamed(render(byKind.argument).steps, 'The Counterargument').markdown), /w &gt; the market wage, employers hire fewer workers/);
}

// Renderer safety: no raw HTML, only http(s) links, images as alt text.
{
    const body = renderBody('<b>raw</b> [bad](javascript:alert(1)) [ok](https://example.org) ![a diagram](https://x.org/a.png)');
    assert.doesNotMatch(body, /<b>|javascript:|<img/);
    assert.match(body, /<a href="https:\/\/example.org" target="_blank" rel="noopener noreferrer">ok<\/a>/);
    assert.match(body, /<span>a diagram<\/span>/);
}
assert.equal(markdownToSpeechText('It froze at **-40 °C** in a well-known case.'), 'It froze at -40 °C in a well-known case.');

console.log(`lesson-render-roundtrip: ok (${fixtures.length} fixtures)`);
