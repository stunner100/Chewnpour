import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const dashboardPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const assignmentPath = path.join(root, 'src', 'pages', 'AssignmentHelper.jsx');

const [dashboardSource, assignmentSource] = await Promise.all([
  fs.readFile(dashboardPath, 'utf8'),
  fs.readFile(assignmentPath, 'utf8'),
]);

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

assertValidationOrder(dashboardSource, 'DashboardAnalysis.jsx', [
  "reason: 'unsupported_file_type'",
  "reason: 'file_too_large'",
  "reason: 'upload_quota_exhausted_preflight'",
]);

assertValidationOrder(assignmentSource, 'AssignmentHelper.jsx', [
  "reason: 'unsupported_file_type'",
  "reason: 'file_too_large'",
  "reason: 'upload_quota_exhausted_preflight'",
]);

console.log('upload-validation-priority-regression.test.mjs passed');
