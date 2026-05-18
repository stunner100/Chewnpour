import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const {
  STUDY_MATERIAL_PROCESSING_ERROR_MESSAGE,
  getUserFacingUploadErrorMessage,
} = await import(new URL('../src/lib/uploadErrorMessages.js', import.meta.url));

const internalWordBankDiagnostic = [
  'Could not generate a valid Word Bank for this topic.',
  'Key Ideas bullets must remain atomic and concise.',
  'Word Bank must include 6-8 term-definition entries.',
  'Lesson sections are repeating the same points too often.',
].join(' ');

const sanitized = getUserFacingUploadErrorMessage(internalWordBankDiagnostic);

assert.equal(
  sanitized,
  STUDY_MATERIAL_PROCESSING_ERROR_MESSAGE,
  'Expected internal Word Bank diagnostics to resolve to learner-safe copy.',
);

for (const forbiddenFragment of [
  'Could not generate a valid Word Bank',
  'Key Ideas bullets',
  'Word Bank must include',
  'Lesson sections are repeating',
]) {
  assert.ok(
    !sanitized.includes(forbiddenFragment),
    `Learner-safe copy must not include internal diagnostic "${forbiddenFragment}".`,
  );
}

assert.equal(
  getUserFacingUploadErrorMessage('The upload could not be read. Try another file.'),
  'The upload could not be read. Try another file.',
  'Expected existing user-facing upload errors to pass through unchanged.',
);

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
  librarySource.includes('Open when ready'),
  'MyMaterialsLibrary.jsx should use neutral unavailable copy for generated-content cards.',
);

assert.ok(
  !librarySource.includes('Upload is ready, but there are no lessons to open yet.'),
  'MyMaterialsLibrary.jsx should not render multi-line no-content explanations inside material cards.',
);

console.log('upload-error-message-sanitization-regression.test.mjs passed');
