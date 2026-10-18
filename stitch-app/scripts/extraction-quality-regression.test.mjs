// Extraction gates: a thin text layer (a scan with only page numbers) is sent
// to OCR, PDF pages stay apart and lose page numbers and running footers,
// DOCX heading styles become markdown headings without headers or footers,
// and OCR noise is cleaned before the text is stored.
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';
import {
    cleanExtractedText,
    isPageNumberLine,
    isThinTextLayer,
    pickThinLayerText,
    prepareExtractedText,
    readableChars,
    removeRunningLines,
} from '../server/extractionQuality.js';
import { callLocalExtract, countPdfPages } from '../server/localExtract.js';

const makePdf = async (pages) => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const lines of pages) {
        const page = doc.addPage([595, 842]);
        lines.forEach((line, index) => page.drawText(line, { x: 40, y: 780 - index * 18, size: 11, font }));
    }
    return Buffer.from(await doc.save());
};
const pdfExtract = (fileBuffer) => callLocalExtract({ fileName: 'notes.pdf', contentType: 'application/pdf', fileType: 'pdf', fileBuffer });

// Page-number lines.
for (const line of ['3', ' 12 ', 'Page 4', 'page 4 of 10', '4 / 10', '- 7 -']) assert.equal(isPageNumberLine(line), true, line);
for (const line of ['3 cells divide', 'Chapter 4', '1. First step', '']) assert.equal(isPageNumberLine(line), false, line);

// A scanned PDF whose text layer is only page numbers is thin; real notes are not.
const scanned = await makePdf([['1'], ['2'], ['3']]);
const scannedText = await pdfExtract(scanned);
assert.equal(scannedText.pageCount, 3);
assert.equal(await countPdfPages(scanned), 3);
assert.equal(isThinTextLayer({ text: scannedText.text, pageCount: 3 }), true);
const sentence = 'Osmosis moves water across a semi-permeable membrane from a dilute solution to a concentrated one.';
assert.equal(isThinTextLayer({ text: Array(3).fill(`${sentence} ${sentence} ${sentence}`).join('\n\n'), pageCount: 3 }), false);
assert.equal(isThinTextLayer({ text: 'short', pageCount: null }), false, 'no page count: no gate');

// After OCR: keep OCR's text when it reads more; keep a thin layer only if it
// holds a page's worth of text; otherwise fail.
assert.equal(pickThinLayerText({ text: '1\n2\n3', ocrText: sentence }), 'ocr');
assert.equal(pickThinLayerText({ text: '1\n2\n3', ocrText: '' }), 'none');
assert.equal(pickThinLayerText({ text: `${sentence} ${sentence} ${sentence}`, ocrText: 'x' }), 'extracted');

// Local PDF: pages are separated by a blank line, and the running footer and
// page numbers are removed before storing.
const footer = (page) => `Unit 3 Cell Biology | Page ${page}`;
const notes = await makePdf([
    ['Cells are the unit of life.', footer(1), '1'],
    ['Mitochondria release energy.', footer(2), '2'],
    ['Ribosomes make proteins.', footer(3), '3'],
    ['The Golgi apparatus packages proteins.', footer(4), '4'],
]);
const notesText = await pdfExtract(notes);
assert.match(notesText.text, /unit of life\.[\s\S]*\n\n[\s\S]*Mitochondria/, 'a page break is a paragraph break');
const stored = prepareExtractedText({ text: notesText.text, pageCount: notesText.pageCount, paged: true });
assert.doesNotMatch(stored, /Unit 3 Cell Biology/);
assert.doesNotMatch(stored, /^\s*\d\s*$/m);
for (const line of ['Cells are the unit of life.', 'Mitochondria release energy.', 'Ribosomes make proteins.', 'The Golgi apparatus packages proteins.']) {
    assert.ok(stored.includes(line), line);
}

// Running lines are counted against the page count; a repeated table row or a
// line under the threshold stays.
const markdown = ['# Cells', 'Header A', 'body one', '| a | b |', 'Header A', 'body two', '| a | b |', 'Header A', 'Repeated twice', 'Repeated twice'].join('\n');
const pruned = removeRunningLines(markdown, 4).split('\n');
assert.equal(pruned.includes('Header A'), false, 'a line on 3 of 4 pages is a running header');
assert.equal(pruned.filter((line) => line === '| a | b |').length, 2, 'table rows are never running lines');
assert.equal(pruned.filter((line) => line === 'Repeated twice').length, 2);
assert.equal(removeRunningLines('Header A\nx\nHeader A\nHeader A', 2), 'Header A\nx\nHeader A\nHeader A', 'short documents keep repeats');
assert.equal(prepareExtractedText({ text: 'Answer:\n42', pageCount: null }), 'Answer:\n42', 'unpaged text keeps number lines');

// OCR noise is cleaned at extraction: letter-spaced headings, orphan brackets.
assert.equal(cleanExtractedText('P E R F O R M A N C E R E P O R T'), 'Performance Report');
assert.equal(cleanExtractedText('see [Figure 2] and ] stray [ here'), 'see [Figure 2] and  stray  here');
assert.equal(cleanExtractedText('```\nx = [1, 2\n```'), '```\nx = [1, 2\n```', 'code blocks are left alone');
assert.equal(cleanExtractedText('a\r\n\n\n\nb c'), 'a\n\nb c');

// DOCX: Title and Heading1-3 styles become headings; runs split mid-word
// join; headers and footers are left out.
const paragraph = (text, style) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${text}</w:p>`;
const run = (text) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const documentXml = `<?xml version="1.0"?><w:document><w:body>${[
    paragraph(run('Cell Biology'), 'Title'),
    paragraph(run('Organelles'), 'Heading1'),
    paragraph(run('Mito') + run('chondria release energy &amp; heat.')),
    paragraph(run('Membranes'), 'Heading2'),
    paragraph(run('Deep detail'), 'Heading4'),
    paragraph(''),
].join('')}</w:body></w:document>`;
const docx = Buffer.from(zipSync({
    'word/document.xml': strToU8(documentXml),
    'word/header1.xml': strToU8(`<w:hdr>${paragraph(run('BIO 101 Running Header'))}</w:hdr>`),
    'word/footer1.xml': strToU8(`<w:ftr>${paragraph(run('Confidential footer'))}</w:ftr>`),
}));
const docxText = await callLocalExtract({
    fileName: 'notes.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileType: 'docx',
    fileBuffer: docx,
});
assert.equal(docxText.text, '# Cell Biology\n\n# Organelles\n\nMitochondria release energy & heat.\n\n## Membranes\n\n### Deep detail');
assert.ok(readableChars(docxText.text) > 0);

console.log('extraction-quality-regression.test.mjs passed');
