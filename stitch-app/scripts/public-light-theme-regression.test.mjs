import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  appSource,
  publicShellSource,
  cssSource,
  signUpSource,
] = await Promise.all([
  read('src/App.jsx'),
  read('src/components/PublicShell.jsx'),
  read('src/index.css'),
  read('src/pages/SignUp.jsx'),
]);

for (const snippet of [
  'useRouteTheme();',
]) {
  if (!appSource.includes(snippet)) {
    throw new Error(`Expected App route guard to include "${snippet}".`);
  }
}

const routeThemeSource = await read('src/lib/useRouteTheme.js');
if (!routeThemeSource.includes('applyTheme(resolveRouteTheme(pathname));')) {
  throw new Error('Expected useRouteTheme to apply route-aware theme without persisting preferences.');
}
if (routeThemeSource.includes('setThemePreference(')) {
  throw new Error('Route theme policy should not rewrite the persisted user theme preference.');
}
if (!routeThemeSource.includes('if (isPublicLightRoute(pathname))')) {
  throw new Error('Expected useRouteTheme to keep public routes on the light product theme.');
}
if (!routeThemeSource.includes('return preferredTheme;')) {
  throw new Error('Expected useRouteTheme to let dashboard routes honor the persisted theme.');
}

for (const [label, source] of [
  ['PublicShell', publicShellSource],
  ['SignUp', signUpSource],
]) {
  if (source.includes("const PAGE_BG = 'rgb(16, 17, 18)'")) {
    throw new Error(`${label} should not hard-code the old dark page background.`);
  }
}

if (!publicShellSource.includes("const PAGE_BG = '#F9F9F9'") && !publicShellSource.includes("const PAGE_BG = '#FAFAFB'")) {
  throw new Error('PublicShell should use the light product background.');
}

if (!signUpSource.includes("import PublicShell from '../components/PublicShell'")) {
  throw new Error('SignUp should reuse PublicShell so auth stays on the light product theme.');
}

for (const snippet of [
  '.cp-input',
  'background: #fff;',
  'color: #0A0A0A;',
  '.cp-card',
  'box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);',
  '.cp-prose strong { color: #0A0A0A; }',
]) {
  if (!cssSource.includes(snippet)) {
    throw new Error(`Expected light public CSS to include "${snippet}".`);
  }
}

console.log('public-light-theme-regression.test.mjs passed');
