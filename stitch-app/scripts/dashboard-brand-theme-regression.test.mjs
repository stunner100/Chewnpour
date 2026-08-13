import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const layoutSource = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');
const brandSource = await fs.readFile(path.join(root, 'src/components/team-switcher.jsx'), 'utf8');

for (const snippet of [
    "import BrandLogo from './BrandLogo.jsx';",
    "import useThemeMode from '../lib/useThemeMode.js';",
    "variant={isDarkMode ? 'white' : 'default'}",
]) {
    if (!brandSource.includes(snippet) && !layoutSource.includes(snippet)) {
        throw new Error(`Expected dashboard shell to include "${snippet}".`);
    }
}

if (brandSource.includes('AI Study Workspace')) {
    throw new Error('Dashboard brand should not duplicate wordmark text beside BrandLogo.');
}

if (
    !brandSource.includes("variant={isDarkMode ? 'white' : 'default'}")
    || !brandSource.includes('group-data-[collapsible=icon]:hidden')
) {
    throw new Error('Expanded sidebar must keep the full ChewnPour wordmark.');
}

if (
    !brandSource.includes('variant="mark"')
    || !brandSource.includes('group-data-[collapsible=icon]:block')
) {
    throw new Error('Collapsed sidebar must switch to the brand mark so the wordmark does not spill.');
}

for (const snippet of [
    'aria-pressed={isDarkMode}',
]) {
    if (!layoutSource.includes(snippet)) {
        throw new Error(`Expected dashboard layout to include "${snippet}".`);
    }
}

if (layoutSource.includes('applyTheme(LIGHT_THEME);')) {
    throw new Error('Dashboard layout must not force the light theme when a user chose dark mode.');
}

if (layoutSource.includes('setThemePreference(LIGHT_THEME);')) {
    throw new Error('Dashboard layout must apply the light route theme without persisting user preference.');
}

if (layoutSource.includes('text-[#6D28D9]') || brandSource.includes('text-[#6D28D9]')) {
    throw new Error('Dashboard brand should use theme tokens instead of hard-coded purple.');
}

if (layoutSource.includes('>psychiatry</span>') || brandSource.includes('>psychiatry</span>')) {
    throw new Error('Dashboard brand should not fall back to the old material icon.');
}

if (
    layoutSource.includes('HexLogo')
    || layoutSource.includes('const DashboardBrandMark = () => (')
    || layoutSource.includes('/logonew.jpeg')
    || brandSource.includes('HexLogo')
    || brandSource.includes('/logonew.jpeg')
) {
    throw new Error('Dashboard should reuse the standard ChewnPour BrandLogo assets.');
}

console.log('dashboard-brand-theme-regression.test.mjs passed');
