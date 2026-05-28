import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');

for (const snippet of [
    "import BrandLogo from './BrandLogo.jsx';",
    "import useThemeMode from '../lib/useThemeMode.js';",
    '<BrandLogo size={34} decorative className="max-w-full" />',
    'aria-pressed={isDarkMode}',
    'AI Study Workspace',
]) {
    if (!source.includes(snippet)) {
        throw new Error(`Expected dashboard layout to include "${snippet}".`);
    }
}

if (source.includes('applyTheme(LIGHT_THEME);')) {
    throw new Error('Dashboard layout must not force the light theme when a user chose dark mode.');
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

if (source.includes('HexLogo') || source.includes('const DashboardBrandMark = () => (') || source.includes('/logonew.jpeg')) {
    throw new Error('Dashboard should reuse the standard ChewnPour BrandLogo assets.');
}

console.log('dashboard-brand-theme-regression.test.mjs passed');
