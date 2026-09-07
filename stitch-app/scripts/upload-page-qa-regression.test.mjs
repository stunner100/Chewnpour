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
  'resolveGenerationStageIndex',
  'upload processing uses real generation stages',
);
requireIncludes(
  uploadSource,
  '<GenerationStageList',
  'upload shows staged generation progress',
);
requireIncludes(
  uploadSource,
  "label: 'Could not finish'",
  'failed extraction is shown without a raw Failed/error dump',
);
requireExcludes(
  uploadSource,
  "label: extraction === 'complete' ? 'Extracted' : 'Stored'",
  'deferred uploads must not look successfully Stored',
);
requireExcludes(uploadSource, 'upload.errorMessage', 'upload cards must not dump raw error messages');
requireExcludes(uploadSource, 'Drop your PDFs, slides, or notes here', 'old inconsistent dropzone copy');
requireIncludes(uploadSource, '\\bqa\\s+probe\\b', 'targeted internal QA probe filter');
requireExcludes(uploadSource, '|| /\\bqa\\b/.test(normalized)', 'overbroad QA upload filter');
requireIncludes(uploadSource, 'Course ready', 'completed generation shows a Course ready state');
requireIncludes(uploadSource, 'Start learning', 'completed generation offers Start learning');
requireExcludes(uploadSource, 'Opening your first lesson', 'generation must not surprise-navigate on ready');

console.log('upload-page-qa-regression.test.mjs passed');
