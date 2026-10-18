import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const librarySource = await fs.readFile(
  new URL('../src/pages/MyMaterialsLibrary.jsx', import.meta.url),
  'utf8',
);

assert.ok(
  !librarySource.includes('errorMessage: upload.errorMessage ||'),
  'MyMaterialsLibrary.jsx must not map raw upload.errorMessage into user-facing material state.',
);

assert.ok(
  !librarySource.includes('getUserFacingUploadErrorMessage'),
  'MyMaterialsLibrary.jsx must not render generated-content failure copy, even sanitized copy.',
);

assert.ok(
  !librarySource.includes('material.errorMessage'),
  'MyMaterialsLibrary.jsx must not keep upload error text in user-facing material state.',
);

for (const forbidden of [
  'Processing failed',
  'Study Unavailable',
  'No study content',
  'Content not generated',
  'Could not generate',
  'Word Bank must include',
]) {
  assert.ok(
    !librarySource.includes(forbidden),
    `MyMaterialsLibrary.jsx must not render generated-content failure copy: ${forbidden}`,
  );
}

assert.ok(
  !librarySource.includes('Upload is ready, but there are no lessons to open yet.'),
  'MyMaterialsLibrary.jsx should not render multi-line no-content explanations inside material cards.',
);

console.log('upload-error-message-sanitization-regression.test.mjs passed');
