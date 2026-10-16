// Runs realistic generated lessons (scripts/fixtures/lessons) through the same
// pipeline the topic page uses: prepareLessonContent -> parseLessonBlocks ->
// study-mode filter -> buildLessonStepsFromBlocks.
//
// Each knownBug() pins today's broken output so a fix shows up as a failing
// assertion. When a fix lands, replace that knownBug() with a plain assertion
// of the fixed behavior (the `fixed` note says what that is).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildLessonStepsFromBlocks,
    filterBlocksByStudyMode,
    parseLessonBlocks,
    prepareLessonContent,
    resolveWordBankTerms,
} from '../src/lib/lessonBlocks.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'lessons');
const fixtures = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'index.json'), 'utf8'));

const render = (fixture, studyMode = 'full') => {
    const content = fs.readFileSync(path.join(fixtureDir, fixture.file), 'utf8');
    const normalized = prepareLessonContent({
        content,
        title: fixture.title,
        description: fixture.description,
    });
    const parsed = parseLessonBlocks(normalized);
    const wordBankTerms = resolveWordBankTerms({ parsedTerms: parsed.wordBankTerms });
    const steps = buildLessonStepsFromBlocks({
        blocks: filterBlocksByStudyMode(parsed.blocks, studyMode),
        topicTitle: fixture.title,
        checks: fixture.checks,
        wordBankTerms,
        studyMode,
    });
    return { content, normalized, parsed, wordBankTerms, steps };
};

const byKind = Object.fromEntries(fixtures.map((fixture) => [fixture.kind, fixture]));
const titles = (steps) => steps.map((step) => step.title);
const stepNamed = (steps, title) => steps.find((step) => step.title === title);
const allBlocks = (steps) => steps.flatMap((step) => step.blocks);

const knownBug = (id, actual, expected, fixed) => {
    assert.deepEqual(
        actual,
        expected,
        `Known bug ${id} no longer reproduces. If this was fixed on purpose, replace this knownBug() with an assertion that ${fixed}.`,
    );
};

// Invariants that hold today and must keep holding.
for (const fixture of fixtures) {
    const { parsed, steps } = render(fixture);
    assert.ok(steps.length >= 4, `${fixture.kind}: expected at least 4 steps, got ${steps.length}`);
    assert.ok(steps.every((step) => step.title && step.blocks.length > 0), `${fixture.kind}: every step needs a title and blocks`);
    assert.ok(parsed.readingMinutes >= 1, `${fixture.kind}: reading time must be at least a minute`);
    assert.equal(steps[0].title, 'Why This Matters', `${fixture.kind}: first step follows the lesson's first H2`);
}

// Concept lesson
{
    const { steps, wordBankTerms } = render(byKind.concept);
    knownBug(
        'C1 (heading promotion)',
        titles(steps),
        [
            'Why This Matters',
            'Key Terms to Know First',
            'The Idea',
            'Size comparison',
            'Examples and Non-Examples',
            'The Attractive Wrong Idea',
            'Use It',
            'Recap from Memory',
        ],
        'the "### Size comparison" sub-heading stays inside "The Idea" and a Word Bank step follows the recap',
    );
    knownBug(
        'M4 (tables)',
        stepNamed(steps, 'Size comparison').blocks
            .filter((block) => String(block.text || '').startsWith('|'))
            .map((block) => block.type),
        ['paragraph', 'paragraph', 'paragraph'],
        'the size table renders as a table block with a header row and two body rows',
    );
    knownBug(
        'M3 (sentence promoted to heading)',
        stepNamed(steps, 'The Attractive Wrong Idea').blocks
            .filter((block) => block.type === 'header' && block.level === 3)
            .map((block) => block.text.slice(0, 20)),
        ['The idea is that the'],
        '"The idea is that the nucleoid…" stays a sentence in its paragraph',
    );
    knownBug(
        'C4 (word bank lost)',
        wordBankTerms.length,
        0,
        'all 4 "**Term**: definition" Word Bank entries become wordBankTerms',
    );
    const checkTitles = steps.filter((step) => step.check).map((step) => step.title);
    assert.deepEqual(checkTitles, ['The Idea', 'The Attractive Wrong Idea'], 'concept checks bind to their sections');
}

// Procedure lesson
{
    const { steps } = render(byKind.procedure);
    knownBug(
        'C1 (code comment becomes a step)',
        titles(steps),
        ['Why This Matters', 'Key Terms to Know First', 'The Steps', 'Worked Example', '20', 'Use It'],
        'the "# 20" code comment stays in the code block and Traps and Mistakes and Recap from Memory are their own steps',
    );
    knownBug(
        'M4 (code blocks)',
        stepNamed(steps, 'Worked Example').blocks
            .filter((block) => block.type === 'paragraph')
            .map((block) => block.text.slice(0, 18)),
        ['Sum the even number', '```python total = 0', 'if n % 2 == 0:', 'total += n print(t'].map((text) => text.slice(0, 18)),
        'the Python example renders as one code block with its indentation intact',
    );
    knownBug(
        'C3 (lines with @ deleted)',
        allBlocks(steps).some((block) => String(block.text || '').includes('@staticmethod')),
        false,
        'the "@staticmethod" bullet in Traps and Mistakes renders',
    );
    assert.equal(stepNamed(steps, 'The Steps').blocks.filter((block) => block.type === 'numbered').length, 4, 'all four numbered steps render');
}

// Narrative lesson
{
    const { steps } = render(byKind.narrative);
    knownBug(
        'C1 (sections merged into neighbours)',
        titles(steps),
        ['Why This Matters', 'Key Terms to Know First', 'Who and When', 'Competing Accounts'],
        'Causal Chain, A Sourced Episode and What Changed After are their own steps, followed by a Word Bank step',
    );
    knownBug(
        'C2 (arrows become quotes)',
        allBlocks(steps).filter((block) => block.type === 'quote').length,
        5,
        'the causal chain "a -> b -> c" renders as one paragraph with no quote blocks',
    );
    knownBug(
        'M7 (check silently dropped)',
        steps.filter((step) => step.check).length,
        0,
        'the "Causal Chain" check is attached to the Causal Chain step',
    );
}

// Argument lesson
{
    const { steps } = render(byKind.argument);
    knownBug(
        'C2 (inequality becomes a quote)',
        stepNamed(steps, 'The Counterargument').blocks.map((block) => block.type).filter((type) => type !== 'spacer'),
        ['header', 'paragraph', 'quote'],
        '"if the wage floor w > the market wage, employers hire fewer workers" stays one paragraph',
    );
    assert.equal(stepNamed(steps, 'Evidence from the Source').check?.id, 'check-argument-evidence', 'argument check binds to its section');
}

// Study modes filter on section names the lesson spines never use.
for (const fixture of fixtures) {
    knownBug(
        `study modes (${fixture.kind})`,
        render(fixture, 'quick_revision').steps.length,
        0,
        `Quick revision shows at least the core sections of the ${fixture.kind} lesson`,
    );
}

console.log(`lesson-render-roundtrip: ok (${fixtures.length} fixtures)`);
