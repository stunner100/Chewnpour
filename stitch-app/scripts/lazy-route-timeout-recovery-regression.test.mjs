import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appSource = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');

for (const forbiddenSnippet of [
  'const LAZY_ROUTE_IMPORT_TIMEOUT_MS',
  'createLazyRouteImportTimeoutError',
  'withLazyRouteTimeout',
  'Promise.race([',
  'isLazyRouteTimeoutError',
  'dynamic import timed out',
]) {
  if (appSource.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: lazy routes should not use timeout-based stale-bundle recovery (${forbiddenSnippet}).`);
  }
}

for (const snippet of [
  'const lazyRoute = (importer, { componentName, namedExport } = {}) => lazy(() =>',
  'importer()',
  'if (isChunkLoadError(error))',
  'const reloadRequested = attemptChunkRecoveryReload(routeName);',
  'reloadRequested={reloadRequested}',
  'Lazy route "${routeName}" did not export a React component.',
]) {
  if (!appSource.includes(snippet)) {
    throw new Error(`Expected App.jsx to include "${snippet}" for lazy-route chunk recovery.`);
  }
}

if (/return new Promise\(\(\) => \{ \}\);/.test(appSource)) {
  throw new Error('Regression detected: lazyRoute should not leave Suspense pending forever after chunk recovery.');
}

console.log('lazy-route-timeout-recovery-regression.test.mjs passed');
