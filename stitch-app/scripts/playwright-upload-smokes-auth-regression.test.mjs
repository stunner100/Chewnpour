import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const targets = [
  'scripts/smoke-existing-accounts-same-pdf.mjs',
  'scripts/smoke-same-pdf-two-accounts.mjs',
  'scripts/tmp-profile-exam-smoke.mjs',
];

const uploadWaitTargets = new Set([
  'scripts/smoke-existing-accounts-same-pdf.mjs',
  'scripts/smoke-same-pdf-two-accounts.mjs',
]);

for (const relativePath of targets) {
  const source = await fs.readFile(path.join(root, relativePath), 'utf8');
  if (!source.includes("/log in|sign in/i")) {
    throw new Error(`${relativePath} should accept both \"Log in\" and \"Sign in\" labels.`);
  }
  if (source.includes('input[type="file"][accept=".pdf,.pptx,.docx"]')) {
    throw new Error(`${relativePath} should not hard-code the exact upload input accept selector.`);
  }
  if (uploadWaitTargets.has(relativePath) && !source.includes('Execution context was destroyed')) {
    throw new Error(`${relativePath} should tolerate dashboard navigation while waiting for the upload input.`);
  }
}

console.log('playwright-upload-smokes-auth-regression.test.mjs passed');
