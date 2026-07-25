import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const localExtract = await import(
  pathToFileURL(path.join(rootDir, 'server/localExtract.js')).href
);
const uploadsSource = await fs.readFile(path.join(rootDir, 'server/uploads.js'), 'utf8');
const uploadUiSource = await fs.readFile(path.join(rootDir, 'src/pages/UploadMaterials.jsx'), 'utf8');
const courseGenSource = await fs.readFile(path.join(rootDir, 'server/courseGeneration.js'), 'utf8');

const {
  callLocalExtract,
  isLocalExtractable,
  resolveLocalParser,
} = localExtract;

assert.equal(
  isLocalExtractable({ fileName: 'notes.pdf', contentType: 'application/pdf' }),
  true,
);
assert.equal(
  isLocalExtractable({ fileName: 'notes.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  true,
);
assert.equal(
  isLocalExtractable({ fileName: 'scan.png', contentType: 'image/png' }),
  false,
  'Images need OCR and must not claim local extract support.',
);
assert.equal(resolveLocalParser({ fileName: 'a.pdf' }), 'pdf_local');
assert.equal(resolveLocalParser({ fileName: 'a.docx' }), 'docx_local');

const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([400, 200]);
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
page.drawText('ChewnPour local extract regression sample.', {
  x: 24,
  y: 120,
  size: 12,
  font,
});
const pdfBytes = await pdfDoc.save();
const pdfResult = await callLocalExtract({
  fileName: 'sample.pdf',
  contentType: 'application/pdf',
  fileType: 'pdf',
  fileBuffer: Buffer.from(pdfBytes),
});
assert.match(pdfResult.text, /ChewnPour local extract regression sample/);
assert.equal(pdfResult.backend, 'local');
assert.equal(pdfResult.parser, 'pdf_local');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Docx local extract works.</w:t></w:r></w:p>
  </w:body>
</w:document>`;
const docxBytes = zipSync({
  'word/document.xml': strToU8(documentXml),
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types></Types>'),
});
const docxResult = await callLocalExtract({
  fileName: 'sample.docx',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  fileType: 'docx',
  fileBuffer: Buffer.from(docxBytes),
});
assert.match(docxResult.text, /Docx local extract works/);
assert.equal(docxResult.parser, 'docx_local');

assert.match(uploadsSource, /from "\.\/localExtract\.js"/);
assert.match(uploadsSource, /callLocalExtract/);
assert.match(uploadsSource, /isLocalExtractable/);
assert.doesNotMatch(
  uploadsSource,
  /Configure Docling extraction to replace this bootstrap outline/,
  'Bootstrap Docling placeholder text must be removed.',
);
assert.doesNotMatch(
  uploadsSource,
  /extraction_status: "not_configured"/,
  'not_configured bootstrap path must be retired.',
);

assert.doesNotMatch(
  uploadUiSource,
  /Configure Docling to extract text/,
);
assert.doesNotMatch(
  courseGenSource,
  /Configure Docling extraction to generate richer topics/,
);

console.log('local-extract-fallback-regression.test.mjs passed');
