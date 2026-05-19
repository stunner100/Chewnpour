import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');

for (const snippet of [
  "import { HexLogo } from './PublicShell.jsx';",
  '<HexLogo size={44} className="text-[#6D28D9]" markClassName="text-[#6D28D9]" />',
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

if (source.includes('const DashboardBrandMark = () => (')) {
  throw new Error('Dashboard should reuse the same HexLogo used by public landing surfaces.');
}

console.log('dashboard-brand-theme-regression.test.mjs passed');
