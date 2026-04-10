import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const flowScriptPath = path.join(root, 'scripts', 'playwright-exam-flow.mjs');
const flowSource = await fs.readFile(flowScriptPath, 'utf8');

if (!flowSource.includes("await page.getByRole('button', { name: /log in|sign in/i }).click();")) {
  throw new Error('Expected ready-account login flow to accept both "Log in" and "Sign in" submit labels.');
}

if (!flowSource.includes("const waitForUploadInput = async () => {")) {
  throw new Error('Expected playwright exam flow to define a dedicated upload-input wait helper.');
}

if (!flowSource.includes("document.querySelector('input[type=\"file\"]')")) {
  throw new Error('Expected upload-input wait helper to look for any file input, not a single exact accept selector.');
}

if (!flowSource.includes("/upload materials|add course/i")) {
  throw new Error('Expected upload-input wait helper to recognize the dashboard upload triggers.');
}

if (flowSource.includes('input[type="file"][accept=".pdf,.pptx,.docx"]')) {
  throw new Error('Expected playwright exam flow to stop hard-coding the exact upload input accept selector.');
}

console.log('playwright-exam-flow-auth-upload-regression.test.mjs passed');
