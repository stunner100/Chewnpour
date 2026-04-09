import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const flowScriptPath = path.join(root, 'scripts', 'playwright-exam-flow.mjs');
const flowSource = await fs.readFile(flowScriptPath, 'utf8');

if (!flowSource.includes('const topicExamCtaPattern = /take final exam|start final exam|take.*quiz|start topic quiz|start exam|retry exam/i;')) {
  throw new Error('Expected playwright-exam-flow to recognize both topic-quiz and final-exam CTA labels.');
}

if (!flowSource.includes("const topicExamCta = page.locator('a, button').filter({ hasText: topicExamCtaPattern }).first();")) {
  throw new Error('Expected playwright-exam-flow to select topic exam CTAs across links and buttons.');
}

if (!flowSource.includes('topicExamCtaText')) {
  throw new Error('Expected playwright-exam-flow to record the matched CTA text for diagnostics.');
}

console.log('playwright-exam-flow-cta-regression.test.mjs passed');
