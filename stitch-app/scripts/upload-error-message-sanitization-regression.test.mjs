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
  librarySource.includes('getUserFacingUploadErrorMessage(upload.errorMessage)'),
  'MyMaterialsLibrary.jsx should sanitize upload.errorMessage before rendering material cards.',
);

assert.ok(
  !librarySource.includes('errorMessage: upload.errorMessage ||'),
  'MyMaterialsLibrary.jsx must not map raw upload.errorMessage into user-facing material state.',
);

console.log('upload-error-message-sanitization-regression.test.mjs passed');
