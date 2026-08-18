import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const settingsSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'AccountStudySettings.jsx'),
  'utf8',
);
const cssSource = await fs.readFile(path.join(root, 'src', 'index.css'), 'utf8');

for (const forbiddenSnippet of [
  'ml-0 md:ml-0 pt-16 min-h-screen',
  'pt-16 min-h-screen',
]) {
  if (settingsSource.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: settings reintroduced duplicate top spacing (${forbiddenSnippet}).`);
  }
}

for (const expectedSnippet of [
  'min-h-[calc(100dvh-4rem)]',
  'Manage your workspace preferences and profile.',
  'Study Preferences',
  'AI Tutor Personality',
  'id="appearance"',
  'inline-flex min-h-11 min-w-11 items-center justify-center',
]) {
  if (!settingsSource.includes(expectedSnippet)) {
    throw new Error(`Expected AccountStudySettings.jsx to include "${expectedSnippet}".`);
  }
}

if (!cssSource.includes('.dark .cp-theme .settings-tutor-card')) {
  throw new Error('Expected index.css to include a dark Settings AI tutor card selector.');
}

console.log('settings-spacing-regression.test.mjs passed');
