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
  "const ACCEPTED_FILE_TYPE_COPY = 'PDF, PPTX, DOCX, MP3, M4A, MP4, WAV, WEBM, OGG, AAC, FLAC';",
  'single supported-format copy source',
);
requireIncludes(
  uploadSource,
  'Please upload one of these supported file types: ${ACCEPTED_FILE_TYPE_COPY}.',
  'validation error mirrors supported formats',
);
requireIncludes(
  uploadSource,
  'Upload PDFs, slides, Word docs, or recordings to generate study guides, flashcards, and quizzes.',
  'header copy mirrors supported formats',
);
requireIncludes(
  uploadSource,
  'Drop PDFs, slides, docs, or audio here',
  'dropzone copy mirrors supported formats',
);
requireIncludes(
  uploadSource,
  'Supported formats: ${ACCEPTED_FILE_TYPE_COPY}. Max 50MB.',
  'dropzone detail copy mirrors supported formats',
);

requireIncludes(
  uploadSource,
  'px-space-4 py-space-5 md:p-space-10 pb-28 md:pb-space-10 pt-16',
  'compact mobile page padding with bottom-nav clearance',
);
requireIncludes(
  uploadSource,
  'px-space-5 py-space-6 md:p-space-12',
  'compact mobile dropzone padding',
);
requireIncludes(
  uploadSource,
  'mt-space-8 md:mt-space-16',
  'compact mobile recent upload spacing',
);

requireExcludes(uploadSource, 'Drop your PDFs, slides, or notes here', 'old inconsistent dropzone copy');
requireExcludes(
  uploadSource,
  'Our AI will automatically process your files, extract key concepts, and prepare them for study generation.',
  'old verbose dropzone detail copy',
);
requireIncludes(uploadSource, '\\bqa\\s+probe\\b', 'targeted internal QA probe filter');
requireExcludes(uploadSource, '|| /\\bqa\\b/.test(normalized)', 'overbroad QA upload filter');

console.log('upload-page-qa-regression.test.mjs passed');
