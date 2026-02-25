import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const dashboardLayoutSource = await read('src/components/DashboardLayout.jsx');
for (const pattern of [
  "useLocation",
  "startsWith('/dashboard/exam')",
  '!hideMobileBottomNav && <MobileBottomNav />',
]) {
  if (!dashboardLayoutSource.includes(pattern)) {
    throw new Error(`Expected DashboardLayout to include "${pattern}".`);
  }
}

const examModeSource = await read('src/pages/ExamMode.jsx');
for (const pattern of [
  'fixed bottom-0 inset-x-0',
  'z-50',
  'md:hidden',
]) {
  if (!examModeSource.includes(pattern)) {
    throw new Error(`Expected ExamMode mobile action bar to include "${pattern}".`);
  }
}

console.log('exam-mobile-nav-visibility-regression.test.mjs passed');
