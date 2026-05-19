import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  appSource,
  publicShellSource,
  cssSource,
  onboardingNameSource,
  onboardingLevelSource,
  onboardingDepartmentSource,
] = await Promise.all([
  read('src/App.jsx'),
  read('src/components/PublicShell.jsx'),
  read('src/index.css'),
  read('src/pages/OnboardingName.jsx'),
  read('src/pages/OnboardingLevel.jsx'),
  read('src/pages/OnboardingDepartment.jsx'),
]);

for (const snippet of [
  'useLayoutEffect(() => {',
  'setThemePreference(LIGHT_THEME);',
]) {
  if (!appSource.includes(snippet)) {
    throw new Error(`Expected App route guard to include "${snippet}".`);
  }
}

for (const [label, source] of [
  ['PublicShell', publicShellSource],
  ['OnboardingName', onboardingNameSource],
  ['OnboardingLevel', onboardingLevelSource],
  ['OnboardingDepartment', onboardingDepartmentSource],
]) {
  if (!source.includes("const PAGE_BG = '#FAFAFB';")) {
    throw new Error(`${label} should use the light product background.`);
  }
  if (source.includes("const PAGE_BG = 'rgb(16, 17, 18)'")) {
    throw new Error(`${label} should not hard-code the old dark page background.`);
  }
}

for (const snippet of [
  '.cp-input',
  'background: #fff;',
  'color: #1f2933;',
  '.cp-card',
  'box-shadow: 0 18px 40px rgba(31,41,51,0.08);',
  '.cp-prose strong { color: #1f2933; }',
]) {
  if (!cssSource.includes(snippet)) {
    throw new Error(`Expected light public CSS to include "${snippet}".`);
  }
}

console.log('public-light-theme-regression.test.mjs passed');
