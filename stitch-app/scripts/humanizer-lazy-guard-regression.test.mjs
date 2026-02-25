import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'src', 'App.jsx');
const pagePath = path.join(root, 'src', 'pages', 'AIHumanizer.jsx');
const appSource = await fs.readFile(appPath, 'utf8');
const pageSource = await fs.readFile(pagePath, 'utf8');

if (!/const lazyRoute = \(importer, \{ componentName, namedExport \} = \{\}\) => lazy\(\(\)/.test(appSource)) {
  throw new Error('Expected App.jsx to define shared lazyRoute helper.');
}

if (!/const AIHumanizer = lazyRoute\(\(\) => import\('\.\/pages\/AIHumanizer'\), \{/.test(appSource)) {
  throw new Error('Expected AIHumanizer route to be loaded via lazyRoute.');
}

for (const pattern of [
  "componentName: 'AIHumanizer'",
  "namedExport: 'AIHumanizer'",
  'Expected the result of a dynamic import() call with a default export for ${componentName || \'route component\'}.',
  "isChunkLoadError(error) && attemptChunkRecoveryReload(componentName || namedExport || 'route')",
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Regression detected: AIHumanizer lazy import is missing pattern "${pattern}".`);
  }
}

for (const pattern of [
  'export const AIHumanizer = () => {',
  'export default AIHumanizer;',
]) {
  if (!pageSource.includes(pattern)) {
    throw new Error(`Regression detected: AIHumanizer export contract is missing pattern "${pattern}".`);
  }
}

console.log('humanizer-lazy-guard-regression.test.mjs passed');
