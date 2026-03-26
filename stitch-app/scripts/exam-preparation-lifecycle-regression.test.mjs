import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const preparationsPath = path.join(root, 'convex', 'examPreparations.ts');
const schemaPath = path.join(root, 'convex', 'schema.ts');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');

const [preparationsSource, schemaSource, examModeSource] = await Promise.all([
  fs.readFile(preparationsPath, 'utf8'),
  fs.readFile(schemaPath, 'utf8'),
  fs.readFile(examModePath, 'utf8'),
]);

for (const pattern of [
  /status:\s*['"]queued['"]/,
  /status:\s*['"]preparing['"]/,
  /status:\s*['"]ready['"]/,
  /status:\s*['"]unavailable['"]/,
  /status:\s*['"]failed['"]/,
]) {
  if (!pattern.test(preparationsSource)) {
    throw new Error('Expected examPreparations.ts to implement the full preparation status lifecycle.');
  }
}

if (!/examPreparations:\s*defineTable\(/.test(schemaSource)) {
  throw new Error('Expected schema.ts to define the examPreparations table.');
}

if (!/const preparation = useQuery\(\s*api\.examPreparations\.getExamPreparation,/s.test(examModeSource)) {
  throw new Error('Expected ExamMode to subscribe to a preparation record.');
}

if (!/const handleRetryStart = useCallback/.test(examModeSource) || !/retryPreparation\(\{\s*preparationId\s*\}\)/.test(examModeSource)) {
  throw new Error('Expected ExamMode to retry failed preparations through retryExamPreparation.');
}

console.log('exam-preparation-lifecycle-regression.test.mjs passed');
