// Sections and terms a live run on The Grid wrote faithfully from the cell
// biology notes, which the grounding check wrongly rejected: capitalised
// words in title-case section titles counted as names ("Phases", "Happens",
// "Speeds"), "lysosomes" stemmed so it no longer matched "Lysosome", and the
// abbreviation "ER" for "endoplasmic reticulum". Invented names, numbers and
// acronyms must still be caught.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTextGroundedInSource, namesIn, sourceHasAcronym, sourceHasWord } from '../server/grounding.js';
import { checkSection, groundLesson } from '../server/lessonGrounding.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'scripts/fixtures/sources/toc-heavy-cell-biology.md'), 'utf8');

const section = (role, title, body, sourceQuote) => ({ role, title, body, sourceQuote });
const faithful = [
    section('example', 'The Four Phases of Mitosis',
        'Mitosis runs through **prophase**, **metaphase**, **anaphase** and **telophase**, followed by cytokinesis.',
        'It runs through prophase, metaphase, anaphase and telophase'),
    section('example', 'What Happens When a Cell Sits in Pure Water',
        'A cell placed in pure water gains water by osmosis. An animal cell may burst, while a plant cell becomes turgid.',
        'A cell placed in pure water gains water by osmosis'),
    section('core', 'What Speeds Up Diffusion',
        'Diffusion is faster with a steeper concentration gradient, a higher temperature and a larger surface area.',
        'The rate of diffusion rises with a steeper concentration gradient'),
    section('core', 'Organelles That Make and Ship Proteins',
        'The rough ER is studded with ribosomes and makes proteins for export. The Golgi apparatus packages them.',
        'The rough endoplasmic reticulum is studded with ribosomes'),
    section('practice', "Try It: Predict the Cell's Fate",
        '### What Would Happen Here?\n\nPredict what happens to an animal cell placed in pure water.',
        'an animal cell may burst'),
];
for (const entry of faithful) {
    assert.deepEqual(checkSection(entry, source), { supported: true, reasons: [] }, entry.title);
}

const { lesson, report } = groundLesson({
    hook: '',
    sections: faithful,
    recap: [],
    wordBank: [
        { term: 'Lysosome', definition: 'An organelle with digestive enzymes.' },
        { term: 'Rough endoplasmic reticulum', definition: 'Makes proteins for export.' },
        { term: 'Spindle fibres', definition: 'Pull chromatids apart.' },
    ],
}, source);
assert.equal(lesson.sections.length, faithful.length, 'no faithful section is dropped');
assert.equal(report.needsReview, false);
assert.deepEqual(report.droppedTerms, []);

// Plural stemming keeps word families together and words in -ss/-us/-is whole.
for (const [word, text] of [
    ['Lysosome', 'Lysosomes digest.'], ['lysosomes', 'A lysosome digests.'], ['study', 'Two studies.'],
    ['process', 'Several processes.'], ['class', 'Classes start.'], ['virus', 'A virus.'], ['analysis', 'The analysis.'],
]) {
    assert.equal(sourceHasWord(word, text), true, `${word} in "${text}"`);
}
assert.equal(sourceHasWord('lysosome', 'Lysol is a cleaner.'), false);

// Acronyms are accepted when the source spells them out in consecutive
// content words, and only then.
assert.equal(sourceHasAcronym('ER', source), true);
assert.equal(sourceHasAcronym('RER', source), true);
assert.equal(sourceHasAcronym('PCR', source), false);
assert.equal(sourceHasAcronym('Golgi', source), false, 'only all-capital words are acronyms');

// Headings in a body are not names; capitals in running text still are.
assert.deepEqual(namesIn('### What Happens Next\n\nIn 1665 Robert Hooke saw the ER.'), ['Robert', 'Hooke', 'ER']);

// Still caught: invented names, numbers and acronyms in the body.
const inventedName = section('example', 'An Early Observation', 'Robert Hooke first described cells in cork.', 'All living things are made of cells');
assert.match(checkSection(inventedName, source).reasons.join(), /names not in source: Hooke/);
const inventedNumber = section('example', 'Counting Ions', 'The pump moves five sodium ions out for every 7 potassium ions in.', 'the sodium-potassium pump');
assert.match(checkSection(inventedNumber, source).reasons.join(), /numbers not in source: 7/);
const inventedAcronym = section('core', 'Copying DNA', 'Scientists copy DNA with PCR in the laboratory.', 'All living things are made of cells');
assert.match(checkSection(inventedAcronym, source).reasons.join(), /names not in source: PCR/);
assert.equal(isTextGroundedInSource('The ER makes proteins for export.', source), true);
assert.equal(isTextGroundedInSource('PCR makes proteins for export.', source), false);

console.log('grounding-false-positives-regression.test.mjs passed');
