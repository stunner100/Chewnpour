import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const uploadSource = await fs.readFile(path.join(root, 'src', 'pages', 'UploadMaterials.jsx'), 'utf8');

const assertValidationOrder = (source, fileName, markers) => {
  const indexes = markers.map((marker) => {
    const index = source.indexOf(marker);
    if (index < 0) {
      throw new Error(`Expected ${fileName} to include marker: ${marker}`);
    }
    return index;
  });

  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] < indexes[i - 1]) {
      throw new Error(
        `Expected validation order in ${fileName} to be ${markers.join(' -> ')}, but found an out-of-order check.`,
      );
    }
  }
};

// Reject unsupported types before size, and both before any upload request is made.
assertValidationOrder(uploadSource, 'UploadMaterials.jsx', [
  'const uploadFileType = resolveStudyUploadFileType(file);',
  'if (file.size > MAX_FILE_SIZE_BYTES) {',
  'const init = await initUpload({',
]);

console.log('upload-validation-priority-regression.test.mjs passed');
