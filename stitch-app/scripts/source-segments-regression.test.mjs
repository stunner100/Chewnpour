// segmentSource splits extracted text into heading-led segments of at most
// maxChars, keeps noise (tables of contents, page numbers, running headers
// and footers) out of segment text, and accounts for every character.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_SEGMENT_CHARS, segmentSource } from '../server/sourceSegments.js';

const sourceDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sources');
const read = (name) => fs.readFileSync(path.join(sourceDir, name), 'utf8');

const NOISE_PATTERNS = [
    [/\.{4,}\s*\d/, 'dot-leader contents line'],
    [/\]\(#[^)]*\)/, 'linked contents entry'],
    [/^\s*\d{1,4}\s*$/m, 'page-number line'],
    [/Dept\. of Biology · Page/, 'running footer'],
];

const checkInvariants = (name, source, result, maxChars = MAX_SEGMENT_CHARS) => {
    const spans = [
        ...result.segments.map((segment) => ({ ...segment, kind: 'segment' })),
        ...result.dropped.map((span) => ({ ...span, kind: 'dropped' })),
    ].sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const span of spans) {
        assert.equal(span.start, cursor, `${name}: spans must be contiguous (gap or overlap at ${cursor})`);
        assert.ok(span.end > span.start, `${name}: spans are never empty`);
        cursor = span.end;
    }
    assert.equal(cursor, source.length, `${name}: spans cover the whole source`);
    result.segments.forEach((segment, index) => {
        assert.equal(segment.index, index);
        assert.ok(segment.text.trim(), `${name}: segment ${index} has text`);
        assert.equal(segment.chars, segment.text.length);
        assert.ok(segment.chars <= maxChars, `${name}: segment ${index} has ${segment.chars} chars (max ${maxChars})`);
        const span = source.slice(segment.start, segment.end);
        for (const line of segment.text.split('\n').filter((entry) => entry.trim())) {
            assert.ok(span.includes(line.trim()), `${name}: segment ${index} text comes from its own span: ${line.slice(0, 50)}`);
        }
        for (const [pattern, label] of NOISE_PATTERNS) {
            assert.doesNotMatch(segment.text, pattern, `${name}: segment ${index} contains a ${label}`);
        }
    });
};

// Lecture notes with a table of contents before the chapters.
{
    const source = read('toc-heavy-cell-biology.md');
    const result = segmentSource(source);
    checkInvariants('toc', source, result);
    assert.deepEqual(result.segments.map((segment) => segment.heading), [
        '', '1. Cell Structure', '2. Membrane Transport', '3. Cell Division', '4. Review Questions',
    ]);
    const holders = result.segments.filter((segment) => segment.text.includes('Mitosis produces two identical daughter cells'));
    assert.deepEqual(holders.map((segment) => segment.heading), ['3. Cell Division'], 'chapter 3 text lives only in the chapter 3 segment');
    assert.ok(result.segments.every((segment) => !/^Contents$/m.test(segment.text)), 'the "Contents" title is dropped with its entries');
}

// Code fences: "# comment" lines inside code are not headings.
{
    const source = read('python-loops-notes.md');
    const result = segmentSource(source);
    checkInvariants('python', source, result);
    assert.deepEqual(result.segments.map((segment) => segment.heading), ['Loops in Python', 'While loops', 'Common errors']);
    assert.match(result.segments[0].text, /```python\ntotal = 0\nfor n in range\(10\):\n {4}if n % 2 == 0:\n {8}total \+= n\nprint\(total\) {2}# 20\n```/);
}

// A scanned PDF whose text layer is only page numbers has no segments.
{
    const source = read('scanned-page-numbers.txt');
    const result = segmentSource(source);
    checkInvariants('scan', source, result);
    assert.equal(result.segments.length, 0);
    assert.deepEqual(result.dropped.map((span) => span.reason), ['page_number']);
}

// Flat PDF text with a running header, footers and page numbers on each page.
{
    const source = read('pdf-running-footers.txt');
    const result = segmentSource(source);
    checkInvariants('footers', source, result);
    const all = result.segments.map((segment) => segment.text).join('\n\n');
    assert.doesNotMatch(all, /Cell Biology Lecture Notes/, 'the running header is dropped');
    const pageStarts = ['Enzymes are biological catalysts', 'The active site is', 'Temperature affects', 'pH also affects', 'Inhibitors reduce', 'Cofactors are'];
    const positions = pageStarts.map((start) => all.indexOf(start));
    assert.ok(positions.every((position) => position >= 0), 'every page body is kept');
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'page bodies stay in order');
}

// Markdown with a linked table of contents, nested headings, an empty parent
// heading, a very long paragraph and an oversized code block.
{
    const source = read('markdown-toc-links.md');
    const result = segmentSource(source);
    checkInvariants('markdown', source, result);
    assert.ok(result.segments.every((segment) => !/Table of Contents/.test(segment.text)));
    assert.deepEqual(result.segments[0].path, ['Part 1: The Process', 'Overview'], 'an empty parent heading folds into the next segment');
    const overview = result.segments.filter((segment) => segment.heading === 'Overview');
    assert.ok(overview.length >= 3, 'the long overview is split');
    assert.deepEqual(overview.map((segment) => segment.continued), [false, ...overview.slice(1).map(() => true)]);
    for (const segment of overview) {
        assert.match(segment.text, /glucose\.$/, 'prose is split at sentence ends');
    }
    const light = result.segments.find((segment) => segment.heading === 'Light reactions');
    assert.deepEqual(light.path, ['Part 1: The Process', 'Overview', 'Light reactions']);
    const code = result.segments.filter((segment) => segment.heading === 'Simulation code' && segment.continued);
    assert.ok(code.length >= 2, 'the oversized code block is split');
    for (const segment of code) {
        assert.ok(segment.start === 0 || source[segment.start - 1] === '\n', 'code is split at line ends');
    }
}

// A smaller limit is respected, and short repeated lines without numbers are kept.
{
    const source = read('toc-heavy-cell-biology.md');
    checkInvariants('toc-500', source, segmentSource(source, { maxChars: 500 }), 500);

    const worked = Array.from({ length: 4 }, (_, i) => `## Problem ${String.fromCharCode(65 + i)}\n\nSolution\n\nMultiply the two numbers, then add the remainder to get the total for case ${String.fromCharCode(65 + i)}.`).join('\n\n');
    const result = segmentSource(worked);
    checkInvariants('worked', worked, result);
    assert.equal(result.segments.filter((segment) => /^Solution$/m.test(segment.text)).length, 4, 'a repeated "Solution" line is content, not a footer');
}

assert.deepEqual(segmentSource(''), { segments: [], dropped: [] });

console.log('source-segments-regression.test.mjs passed');
