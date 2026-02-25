import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const matrixScriptPath = path.join(root, 'scripts', 'exam-reliability-matrix.mjs');
const flowScriptPath = path.join(root, 'scripts', 'playwright-exam-flow.mjs');

const matrixSource = await fs.readFile(matrixScriptPath, 'utf8');
const flowSource = await fs.readFile(flowScriptPath, 'utf8');

const expectedScenarioNames = [
  'new-user-upload-chromium',
  'existing-user-ready-firefox',
  'existing-user-ready-webkit-iphone13',
  'existing-user-ready-chromium-slow3g',
  'existing-user-ready-transient-offline-blip',
];

for (const scenarioName of expectedScenarioNames) {
  if (!matrixSource.includes(scenarioName)) {
    throw new Error(`Expected matrix script to include scenario "${scenarioName}".`);
  }
}

if (!/RUN_LOAD/.test(matrixSource) || !/loadWorkers/.test(matrixSource)) {
  throw new Error(
    'Expected matrix script to support optional load/concurrency coverage via RUN_LOAD and loadWorkers.'
  );
}

if (!/BROWSER_NAME/.test(flowSource)) {
  throw new Error('Expected playwright-exam-flow script to support BROWSER_NAME configuration.');
}

if (!/DEVICE_PROFILE/.test(flowSource)) {
  throw new Error('Expected playwright-exam-flow script to support DEVICE_PROFILE configuration.');
}

if (!/NETWORK_PROFILE/.test(flowSource) || !/slow3g/.test(flowSource)) {
  throw new Error('Expected playwright-exam-flow script to support slow3g network emulation.');
}

if (!/TRANSIENT_OFFLINE_BLIP_MS/.test(flowSource)) {
  throw new Error(
    'Expected playwright-exam-flow script to support transient offline blips for failure-condition testing.'
  );
}

console.log('exam-reliability-matrix-regression.test.mjs passed');
