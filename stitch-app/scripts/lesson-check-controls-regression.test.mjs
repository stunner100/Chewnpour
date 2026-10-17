// In-lesson checks never block and work without a mouse: grading is retried
// after the attempt is recorded, ordering steps move with buttons and the
// move is announced, the answer radio group has roving focus, and results are
// announced in a status region.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    gradeWithRetry,
    moveAnnouncement,
    moveStep,
    nextRadioIndex,
    radioTabIndex,
} from '../src/lib/lessonCheckControls.js';

// Grading: retried after each delay, then the last error is thrown.
{
    const waits = [];
    let calls = 0;
    const result = await gradeWithRetry(async () => {
        calls += 1;
        if (calls < 3) throw new Error('503');
        return { correct: true };
    }, { wait: async (ms) => waits.push(ms) });
    assert.deepEqual(result, { correct: true });
    assert.deepEqual(waits, [1000, 3000]);
    await assert.rejects(
        gradeWithRetry(async () => { throw new Error('down'); }, { wait: async () => {} }),
        /down/,
    );
}

// Moving steps.
const steps = ['a', 'b', 'c'];
assert.deepEqual(moveStep(steps, 2, -1), ['a', 'c', 'b']);
assert.deepEqual(moveStep(steps, 0, 1), ['b', 'a', 'c']);
assert.equal(moveStep(steps, 0, -1), steps, 'the top step cannot move up');
assert.equal(moveStep(steps, 2, 1), steps, 'the bottom step cannot move down');
assert.equal(moveAnnouncement('Glycolysis', 1, 3), 'Moved "Glycolysis" to position 1 of 3.');

// Radio keyboard pattern.
assert.equal(nextRadioIndex(null, 'ArrowDown', 4), 0);
assert.equal(nextRadioIndex(null, 'ArrowUp', 4), 3);
assert.equal(nextRadioIndex(3, 'ArrowRight', 4), 0, 'wraps at the end');
assert.equal(nextRadioIndex(0, 'ArrowLeft', 4), 3, 'wraps at the start');
assert.equal(nextRadioIndex(2, 'Home', 4), 0);
assert.equal(nextRadioIndex(0, 'End', 4), 3);
assert.equal(nextRadioIndex(1, 'Enter', 4), null);
assert.deepEqual([0, 1, 2].map((index) => radioTabIndex(index, null)), [0, -1, -1]);
assert.deepEqual([0, 1, 2].map((index) => radioTabIndex(index, 2)), [-1, -1, 0]);

// Rendered components.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loadComponent = async (relativePath) => {
    const outfile = path.join(root, 'node_modules', '.cache', 'lesson-check-controls', `${path.basename(relativePath, '.jsx')}.mjs`);
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
const LessonInlineCheck = await loadComponent('src/components/lesson/LessonInlineCheck.jsx');
const LessonOrderingCheck = await loadComponent('src/components/lesson/LessonOrderingCheck.jsx');
const html = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

const ordering = html(LessonOrderingCheck, {
    check: { id: 'q1', prompt: 'Order the stages', options: ['Glycolysis', 'Krebs cycle', 'Electron transport'] },
    onSubmit: async () => {},
});
const moveLabels = [...ordering.matchAll(/<button[^>]*aria-label="(Move step [^"]+)"[^>]*>/g)].map((match) => [match[1], /disabled=""/.test(match[0])]);
assert.deepEqual(moveLabels, [
    ['Move step 1, Glycolysis, up', true],
    ['Move step 1, Glycolysis, down', false],
    ['Move step 2, Krebs cycle, up', false],
    ['Move step 2, Krebs cycle, down', false],
    ['Move step 3, Electron transport, up', false],
    ['Move step 3, Electron transport, down', true],
]);
assert.match(ordering, /role="status" aria-live="polite"/, 'moves and results are announced');
assert.match(ordering, /aria-describedby="q1-instructions"/);

const choice = html(LessonInlineCheck, {
    check: { id: 'q2', prompt: 'Where does glycolysis happen?', options: ['Cytoplasm', 'Matrix', 'Nucleus'] },
    topicId: 't1',
});
const radios = [...choice.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((match) => match[0].match(/tabindex="(-?\d)"/)?.[1]);
assert.deepEqual(radios, ['0', '-1', '-1'], 'one radio in the tab order');
assert.match(choice, /role="radiogroup"/);
assert.match(choice, /role="status" aria-live="polite"/, 'results are announced');

console.log('lesson-check-controls-regression.test.mjs passed');
