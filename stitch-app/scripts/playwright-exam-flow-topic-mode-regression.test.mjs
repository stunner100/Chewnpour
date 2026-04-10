import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const flowScriptPath = path.join(root, 'scripts', 'playwright-exam-flow.mjs');
const flowSource = await fs.readFile(flowScriptPath, 'utf8');

if (!flowSource.includes("const prepareTopicForExamStart = async () => {")) {
  throw new Error('Expected playwright exam flow to define a topic study-mode preparation helper.');
}

if (!flowSource.includes("page.getByRole('button', { name: /practice only/i }).first();")) {
  throw new Error('Expected playwright exam flow to recognize the Practice Only study mode.');
}

if (!flowSource.includes("appendNote('Selected Practice Only on study-mode chooser.');")) {
  throw new Error('Expected playwright exam flow to record when it uses the study-mode chooser.');
}

if (!flowSource.includes("topicExamCtaText: 'auto-navigated-to-exam'")) {
  throw new Error('Expected playwright exam flow to support study-mode selections that navigate directly to exam mode.');
}

console.log('playwright-exam-flow-topic-mode-regression.test.mjs passed');
