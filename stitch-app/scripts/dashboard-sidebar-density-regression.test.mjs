import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Dashboard sidebar should keep ${label}: ${snippet}`);
  }
};

requireIncludes('gap-space-4 z-20', 'compact sidebar section spacing');
requireIncludes('font-label-sm text-label-sm py-2.5', 'compact generate-material button typography');
requireIncludes('gap-2.5 px-3 py-2.5 rounded-xl', 'compact navigation row spacing');
requireIncludes('material-symbols-outlined text-[18px]', 'compact navigation icons');
requireIncludes('font-body-sm text-body-sm', 'compact navigation labels');

if (source.includes('font-body-base text-body-base">{item.label}</span>')) {
  throw new Error('Dashboard sidebar nav labels should not use body-base sizing.');
}

console.log('dashboard-sidebar-density-regression.test.mjs passed');
