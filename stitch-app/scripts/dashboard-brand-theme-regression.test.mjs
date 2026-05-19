import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');

for (const snippet of [
  'const DashboardBrandMark = () => (',
  'points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"',
  'src="/logonew.jpeg"',
  'text-[#6D28D9]',
  'setThemePreference(LIGHT_THEME);',
]) {
  if (!source.includes(snippet)) {
    throw new Error(`Expected dashboard layout to include "${snippet}".`);
  }
}

if (source.includes('>psychiatry</span>')) {
  throw new Error('Dashboard brand should not fall back to the old material icon.');
}

console.log('dashboard-brand-theme-regression.test.mjs passed');
