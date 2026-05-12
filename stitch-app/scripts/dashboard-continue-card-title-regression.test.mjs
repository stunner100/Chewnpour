import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/StudentDashboard.jsx'), 'utf8');

const compactTitleClass = 'font-display-md text-display-md text-text-primary mb-space-2 leading-tight line-clamp-2 [overflow-wrap:anywhere]';

if (!source.includes(compactTitleClass)) {
  throw new Error('Continue Studying card title should use compact two-line typography for long uploaded material names.');
}

if (source.includes('<h3 className="font-display-lg text-display-lg text-text-primary mb-space-2">')) {
  throw new Error('Continue Studying card title should not use the oversized display-lg treatment.');
}

console.log('dashboard-continue-card-title-regression.test.mjs passed');
