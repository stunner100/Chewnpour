import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dashboardProcessingPath = path.join(root, 'src', 'pages', 'DashboardProcessing.jsx');
const source = await fs.readFile(dashboardProcessingPath, 'utf8');

if (!/const\s+processUploadedFile\s*=\s*useAction\(api\.ai\.processUploadedFile\)/.test(source)) {
  throw new Error('Expected DashboardProcessing to initialize processUploadedFile action.');
}

if (!/Upload processing kickoff retry triggered/.test(source)) {
  throw new Error('Expected DashboardProcessing to emit a kickoff-retry breadcrumb/message.');
}

if (!/window\.setTimeout\(\(\)\s*=>[\s\S]*12000\)/s.test(source)) {
  throw new Error('Expected DashboardProcessing to schedule a delayed retry for stuck processing uploads.');
}

if (!/upload\.status\s*!==\s*'processing'/.test(source) || !/upload\.processingStep/.test(source)) {
  throw new Error('Expected DashboardProcessing retry guard to gate on processing status with missing step.');
}

if (!/processUploadedFile\(\{\s*[\s\S]*uploadId:\s*upload\._id,\s*[\s\S]*courseId:\s*resolvedCourseId,\s*[\s\S]*userId,?[\s\S]*\}\)/s.test(source)) {
  throw new Error('Expected DashboardProcessing retry to re-dispatch processUploadedFile with uploadId/courseId/userId.');
}

console.log('upload-processing-kickoff-retry-regression.test.mjs passed');
