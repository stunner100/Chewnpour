import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const flowScriptPath = path.join(root, 'scripts', 'playwright-exam-flow.mjs');
const flowSource = await fs.readFile(flowScriptPath, 'utf8');

if (!flowSource.includes('const collectDashboardCourseDiscoveryState = async () => {')) {
  throw new Error('Expected playwright exam flow to capture dashboard discovery state before choosing a course.');
}

if (!flowSource.includes('const waitForDashboardCourseDiscovery = async () => {')) {
  throw new Error('Expected playwright exam flow to define a dedicated ready-dashboard discovery wait helper.');
}

if (!flowSource.includes('/Loading(?: your account)?(?:\\.\\.\\.)?/i')) {
  throw new Error('Expected ready-dashboard discovery to wait for both dashboard loading shell variants to clear.');
}

if (!flowSource.includes('const snapshot = await waitForDashboardCourseDiscovery();')) {
  throw new Error('Expected discoverDashboardCourseUrls to wait for dashboard course discovery readiness.');
}

if (!/Your courses\|No courses yet\|Add Course/.test(flowSource)) {
  throw new Error('Expected ready-dashboard discovery to tolerate both populated and empty dashboard states.');
}

if (!flowSource.includes('Dashboard course discovery timed out. Last body snapshot:')) {
  throw new Error('Expected ready-dashboard discovery to emit timeout diagnostics when no courses are found.');
}

console.log('playwright-exam-flow-ready-dashboard-regression.test.mjs passed');
