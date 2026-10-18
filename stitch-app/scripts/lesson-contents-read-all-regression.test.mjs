// The lesson's Contents and More sheets are modal dialogs with a labelled
// title; Contents lists the real section titles with their role labels; the
// stepper offers a "Read all" view next to the default step-by-step view.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildLessonView } from '../src/lib/lessonView.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loadComponent = async (relativePath) => {
    const outfile = path.join(root, 'node_modules', '.cache', 'lesson-contents-read-all', `${path.basename(relativePath, '.jsx')}.mjs`);
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
const html = (Component, props, ...children) => renderToStaticMarkup(React.createElement(Component, props, ...children));

const LessonSheet = await loadComponent('src/components/lesson/LessonSheet.jsx');
const LessonContentsList = await loadComponent('src/components/lesson/LessonContentsList.jsx');
const LessonSectionStepper = await loadComponent('src/components/lesson/LessonSectionStepper.jsx');

const lesson = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/lessons/structured-osmosis.json'), 'utf8'));
const { steps } = buildLessonView({ lesson });

// Sheet: nothing when closed; a labelled modal dialog with a close button when open.
assert.equal(html(LessonSheet, { open: false, title: 'Contents', closeLabel: 'Close contents' }), '');
const sheet = html(LessonSheet, { open: true, title: 'Contents', closeLabel: 'Close contents' }, 'body');
assert.match(sheet, /role="dialog"/);
assert.match(sheet, /aria-modal="true"/);
const labelledBy = sheet.match(/aria-labelledby="([^"]+)"/)[1];
assert.match(sheet, new RegExp(`<h2 id="${labelledBy}"[^>]*>Contents</h2>`), 'the dialog is labelled by its title');
assert.match(sheet, /aria-label="Close contents"/);

// Contents: real titles in order, role labels for non-core sections, current marked.
const contents = html(LessonContentsList, { steps, currentIndex: 1 });
const items = [...contents.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => match[1].replace(/<[^>]+>/g, '|').split('|').filter(Boolean));
assert.deepEqual(items, [
    ['1', 'How water moves across a membrane'],
    ['2', 'Steps', 'Predicting the direction of osmosis'],
    ['3', 'Example', 'A plant cell in pure water'],
    ['4', 'Common mistake', 'Osmosis is not the diffusion of solutes'],
    ['5', 'Try it', 'Try it: potato strips in salt water'],
    ['6', 'Recap'],
    ['7', 'Word Bank'],
]);
assert.equal((contents.match(/aria-current="step"/g) || []).length, 1);
assert.match(contents, /aria-current="step"[^>]*>[\s\S]*?Predicting the direction/);

// Stepper: step by step by default, with a "Read all" toggle.
const stepper = html(LessonSectionStepper, { steps, topicId: 't1', wordBankTerms: [] });
assert.match(stepper, /<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?Read all<\/button>/);
assert.equal((stepper.match(/<article/g) || []).length, 1, 'one section at a time by default');

// Dead lesson components are gone.
for (const file of ['src/components/lesson/LessonTOC.jsx', 'src/components/lesson/FloatingStudyTools.jsx']) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} is deleted`);
}

console.log('lesson-contents-read-all-regression.test.mjs passed');
