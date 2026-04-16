import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');

const examModeSource = await fs.readFile(examModePath, 'utf8');

const requiredSnippets = [
  'const START_EXAM_ATTEMPT_TRANSIENT_RETRY_MAX = 1;',
  'const START_EXAM_ATTEMPT_TRANSIENT_RETRY_BASE_DELAY_MS = 900;',
  'const canAutoRetryTransientStart =',
  'captureSentryMessage(\'Exam preparation transient start failure; auto retrying\'',
  'await waitFor(START_EXAM_ATTEMPT_TRANSIENT_RETRY_BASE_DELAY_MS * startAttempt);',
  'You are offline. Reconnect to the internet and tap Retry.',
];

for (const snippet of requiredSnippets) {
  if (!examModeSource.includes(snippet)) {
    throw new Error(`Expected ExamMode.jsx to include "${snippet}" for transient exam-start retries.`);
  }
}

console.log('exam-start-transient-retry-regression.test.mjs passed');
