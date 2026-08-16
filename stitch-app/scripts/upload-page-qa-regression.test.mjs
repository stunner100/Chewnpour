import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const uploadSource = await fs.readFile(path.join(root, 'src/pages/UploadMaterials.jsx'), 'utf8');
const htmlSource = await fs.readFile(path.join(root, 'index.html'), 'utf8');

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Expected ${label}: ${snippet}`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Unexpected ${label}: ${snippet}`);
  }
};

requireIncludes(
  htmlSource,
  '<meta name="mobile-web-app-capable" content="yes" />',
  'modern mobile web app meta tag',
);

requireIncludes(
  uploadSource,
  "const ACCEPTED_FILE_TYPE_COPY = 'PDF, PPTX, DOCX';",
  'single supported-format copy source',
);
requireIncludes(
  uploadSource,
  "const ACCEPTED_FILE_TYPES = '.pdf,.pptx,.docx';",
  'accept list limited to extractable study formats',
);
requireIncludes(
  uploadSource,
  'Please upload one of these supported file types: ${ACCEPTED_FILE_TYPE_COPY}.',
  'validation error mirrors supported formats',
);
requireIncludes(
  uploadSource,
  'Upload PDF, DOCX, or PPTX files. ChewnPour extracts text and prepares lessons and quizzes.',
  'header copy mirrors supported formats',
);
requireIncludes(
  uploadSource,
  'Drop PDF, DOCX, or PPTX files here',
  'dropzone copy mirrors supported formats',
);
requireIncludes(
  uploadSource,
  'Supported formats: ${ACCEPTED_FILE_TYPE_COPY}. Max 50MB.',
  'dropzone detail copy mirrors supported formats',
);
requireIncludes(
  uploadSource,
  "label: 'Failed'",
  'failed extraction is shown as Failed not Stored',
);
requireExcludes(
  uploadSource,
  "label: extraction === 'complete' ? 'Extracted' : 'Stored'",
  'deferred uploads must not look successfully Stored',
);
requireExcludes(uploadSource, 'audio/*', 'audio must not be in accept list');
requireExcludes(uploadSource, 'Drop your PDFs, slides, or notes here', 'old inconsistent dropzone copy');
requireIncludes(uploadSource, '\\bqa\\s+probe\\b', 'targeted internal QA probe filter');
requireExcludes(uploadSource, '|| /\\bqa\\b/.test(normalized)', 'overbroad QA upload filter');

console.log('upload-page-qa-regression.test.mjs passed');
