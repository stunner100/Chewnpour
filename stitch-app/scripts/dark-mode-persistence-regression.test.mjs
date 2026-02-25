import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const themePath = path.join(root, 'src', 'lib', 'theme.js');
const mainPath = path.join(root, 'src', 'main.jsx');
const profilePath = path.join(root, 'src', 'pages', 'Profile.jsx');

const [themeSource, mainSource, profileSource] = await Promise.all([
  fs.readFile(themePath, 'utf8'),
  fs.readFile(mainPath, 'utf8'),
  fs.readFile(profilePath, 'utf8'),
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

if (!/toggleThemePreference/.test(profileSource) || !/handleDarkModeToggle/.test(profileSource)) {
  throw new Error('Regression detected: profile dark mode toggle is not wired to persisted theme helpers.');
}

if (/document\.documentElement\.classList\.toggle\('dark'\)/.test(profileSource)) {
  throw new Error('Regression detected: profile dark mode toggle bypasses theme persistence.');
}

console.log('dark-mode-persistence-regression.test.mjs passed');
