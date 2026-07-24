import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const themePath = path.join(root, 'src', 'lib', 'theme.js');
const mainPath = path.join(root, 'src', 'main.jsx');
const profilePath = path.join(root, 'src', 'pages', 'Profile.jsx');
const dashboardLayoutPath = path.join(root, 'src', 'components', 'DashboardLayout.jsx');
const routeThemePath = path.join(root, 'src', 'lib', 'useRouteTheme.js');

const [themeSource, mainSource, profileSource, dashboardLayoutSource, routeThemeSource] = await Promise.all([
  fs.readFile(themePath, 'utf8'),
  fs.readFile(mainPath, 'utf8'),
  fs.readFile(profilePath, 'utf8'),
  fs.readFile(dashboardLayoutPath, 'utf8'),
  fs.readFile(routeThemePath, 'utf8'),
]);

if (!/THEME_STORAGE_KEY\s*=\s*'stitch-theme'/.test(themeSource)) {
  throw new Error('Regression detected: theme persistence key is missing.');
}

if (!/localStorage\.setItem\(THEME_STORAGE_KEY,\s*nextTheme\)/.test(themeSource)) {
  throw new Error('Regression detected: theme preferences are no longer persisted.');
}

if (!/initializeTheme\(\)/.test(mainSource)) {
  throw new Error('Regression detected: app startup no longer applies persisted theme.');
}

if (!sourceIncludesRedirect(profileSource)) {
  throw new Error('Regression detected: Profile.jsx is no longer a hard redirect to settings.');
}

if (!/useThemeMode/.test(dashboardLayoutSource) || !/aria-pressed=\{isDarkMode\}/.test(dashboardLayoutSource)) {
  throw new Error('Regression detected: dashboard dark mode toggle is not wired through useThemeMode.');
}

if (/applyTheme\(LIGHT_THEME\)/.test(dashboardLayoutSource)) {
  throw new Error('Regression detected: dashboard layout still forces light mode on mount.');
}

if (!/return preferredTheme;/.test(routeThemeSource)) {
  throw new Error('Regression detected: dashboard routes no longer honor persisted theme preference.');
}

function sourceIncludesRedirect(source) {
  return source.includes('Navigate to="/dashboard/settings#profile"');
}

console.log('dark-mode-persistence-regression.test.mjs passed');
