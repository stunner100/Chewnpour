import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dashboardPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const source = await fs.readFile(dashboardPath, 'utf8');

if (!/const STREAK_MILESTONES = \[2, 3, 5, 7, 14, 30, 60, 100\];/.test(source)) {
  throw new Error('Regression detected: streak milestone list is missing from DashboardAnalysis.');
}

if (!/window\.localStorage\.setItem\(\s*getStreakStorageKey\(userId\)/.test(source)) {
  throw new Error('Regression detected: streak milestone tracking no longer persists per-user state.');
}

if (!/setStreakToastMessage\(\s*`Congrats! You've reached a \$\{reachedMilestone\}-day streak\. Keep going!`\s*\)/.test(source)) {
  throw new Error('Regression detected: streak milestone toast message is missing.');
}

if (!/<Toast message=\{streakToastMessage\}/.test(source)) {
  throw new Error('Regression detected: streak milestone toast is not rendered.');
}

console.log('streak-milestone-toast-regression.test.mjs passed');
