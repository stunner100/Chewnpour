import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { planPageGroups, splitPdfForOcr } from '../server/ocrPdfChunks.js';

const MB = 1024 * 1024;

// Grouping: pages in order, at most 3 per group and under the byte cap;
// a page too big on its own is skipped, not sent.
assert.deepEqual(
    planPageGroups([100, 100, 100, 100, 100], { maxBytes: 1000, maxPages: 3 }),
    { groups: [[0, 1, 2], [3, 4]], skipped: [] },
);
assert.deepEqual(
    planPageGroups([600, 600, 2000, 300], { maxBytes: 1000, maxPages: 3 }),
    { groups: [[0], [1, 3]], skipped: [2] },
);

// A "scanned" PDF: 7 pages, each carrying ~350KB of incompressible data
// (a stand-in for a page image), each labelled with its page number.
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let index = 0; index < 7; index += 1) {
    const page = doc.addPage([400 + index, 400]); // width encodes the page number
    page.drawText(`page-${index + 1}`, { x: 20, y: 20, size: 12, font });
    const blob = doc.context.flateStream(randomBytes(350 * 1024));
    page.node.set(doc.context.obj('Blob'), doc.context.register(blob));
}
const pdf = Buffer.from(await doc.save());
assert.ok(pdf.length > 2 * MB, 'fixture is over the free-tier size');

const split = await splitPdfForOcr(pdf, { maxBytes: MB, maxPages: 3 });
assert.equal(split.pageCount, 7);
assert.deepEqual(split.chunks.flatMap((chunk) => chunk.pages), [0, 1, 2, 3, 4, 5, 6], 'every page, in order');
for (const chunk of split.chunks) {
    assert.ok(chunk.buffer.length <= MB, 'each request stays under 1MB');
    assert.ok(chunk.pages.length <= 3, 'each request stays within 3 pages');
}

// callOcrSpace splits large PDFs and joins the text in page order.
process.env.OCR_SPACE_API_KEY = 'test-key';
delete process.env.OCR_SPACE_MAX_BYTES;
delete process.env.OCR_SPACE_MAX_PAGES;
const { callOcrSpace } = await import('../server/ocrSpaceClient.js');
let requests = 0;
globalThis.fetch = async (_url, { body }) => {
    requests += 1;
    const data = Buffer.from(body.get('base64Image').split(',')[1], 'base64');
    const chunk = await PDFDocument.load(data);
    assert.ok(data.length <= MB);
    const text = chunk.getPages().map((page) => `page-${page.getWidth() - 399}`).join('\n');
    // Finish out of order, as concurrent requests can.
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 30));
    return new Response(JSON.stringify({ ParsedResults: [{ ParsedText: text }], OCRExitCode: 1 }), { status: 200 });
};
const result = await callOcrSpace({ fileBuffer: pdf, contentType: 'application/pdf', fileName: 'paper.pdf' });
assert.equal(requests, split.chunks.length);
assert.equal(result.pageCount, 7);
assert.deepEqual(
    result.text.split('\n').filter(Boolean),
    ['page-1', 'page-2', 'page-3', 'page-4', 'page-5', 'page-6', 'page-7'],
    'text for every page, in page order',
);
assert.match(result.warnings.join(' '), /OCR ran in \d+ parts/);

// Small PDFs still go in one request.
requests = 0;
const small = await PDFDocument.create();
small.addPage([200, 200]);
await callOcrSpace({ fileBuffer: Buffer.from(await small.save()), contentType: 'application/pdf' });
assert.equal(requests, 1);

// Every page too big: fail clearly instead of reporting "no text".
process.env.OCR_SPACE_MAX_BYTES = String(100 * 1024);
await assert.rejects(
    callOcrSpace({ fileBuffer: pdf, contentType: 'application/pdf' }),
    /every page is over/,
);
delete process.env.OCR_SPACE_MAX_BYTES;

console.log('ocr-pdf-chunks regression passed');
