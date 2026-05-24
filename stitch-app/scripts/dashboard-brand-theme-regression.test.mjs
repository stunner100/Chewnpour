import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');

for (const snippet of [
  "import { HexLogo } from './PublicShell.jsx';",
  '<HexLogo size={44} className="text-primary" markClassName="text-primary" />',
  'text-primary font-bold',
  'applyTheme(LIGHT_THEME);',
]) {
  if (!source.includes(snippet)) {
    throw new Error(`Expected dashboard layout to include "${snippet}".`);
  }
}

if (source.includes('setThemePreference(LIGHT_THEME);')) {
  throw new Error('Dashboard layout must apply the light route theme without persisting user preference.');
}

if (source.includes('text-[#6D28D9]')) {
  throw new Error('Dashboard brand should use theme tokens instead of hard-coded purple.');
}

if (source.includes('>psychiatry</span>')) {
  throw new Error('Dashboard brand should not fall back to the old material icon.');
}

if (source.includes('const DashboardBrandMark = () => (')) {
  throw new Error('Dashboard should reuse the same HexLogo used by public landing surfaces.');
}

console.log('dashboard-brand-theme-regression.test.mjs passed');
