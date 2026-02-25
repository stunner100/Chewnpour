import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const mobileNavSource = await read('src/components/MobileBottomNav.jsx');
for (const pattern of [
  'const getTabClassName = (active)',
  'const renderTabContent = (tab, active)',
  'if (active) {',
  'pointer-events-none',
  'role="link"',
  'to={tab.path}',
]) {
  if (!mobileNavSource.includes(pattern)) {
    throw new Error(`Expected MobileBottomNav to include "${pattern}" for active-tab non-navigation behavior.`);
  }
}

const humanizerSource = await read('src/pages/AIHumanizer.jsx');
for (const pattern of [
  'min-h-[100svh]',
  'pb-24',
]) {
  if (!humanizerSource.includes(pattern)) {
    throw new Error(`Expected AIHumanizer to include "${pattern}" for stable mobile scrolling.`);
  }
}

console.log('humanizer-mobile-scroll-regression.test.mjs passed');
