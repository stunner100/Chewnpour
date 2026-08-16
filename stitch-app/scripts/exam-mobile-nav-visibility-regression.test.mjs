import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const dashboardLayoutSource = await read('src/components/DashboardLayout.jsx');
for (const pattern of [
  'useLocation',
  '(?:quiz\\/(?!results\\/)|topic\\/)',
  '!hideMobileBottomNav && <MobileBottomNav />',
]) {
  if (!dashboardLayoutSource.includes(pattern)) {
    throw new Error(`Expected DashboardLayout to include "${pattern}".`);
  }
}

const examModeSource = await read('src/pages/ExamMode.jsx');
for (const pattern of [
  'Submit exam',
  'sticky top-0',
  'requestSubmit',
]) {
  if (!examModeSource.includes(pattern)) {
    throw new Error(`Expected ExamMode sticky exam chrome to include "${pattern}".`);
  }
}

console.log('exam-mobile-nav-visibility-regression.test.mjs passed');
