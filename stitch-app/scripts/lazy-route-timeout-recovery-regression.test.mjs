import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appSource = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');

for (const snippet of [
  'const LAZY_ROUTE_IMPORT_TIMEOUT_MS = 12000;',
  'const createLazyRouteImportTimeoutError = (routeName) => {',
  'const withLazyRouteTimeout = (importer, routeName) =>',
  'Promise.race([',
  'isChunkLoadError(error) || isLazyRouteTimeoutError(error)',
  'attemptChunkRecoveryReload(routeName);',
  'default: () => <ChunkRecoveryFallback componentName={routeName} />',
]) {
  if (!appSource.includes(snippet)) {
    throw new Error(`Expected App.jsx to include "${snippet}" for lazy-route timeout recovery.`);
  }
}

if (/return new Promise\(\(\) => \{ \}\);/.test(appSource)) {
  throw new Error('Regression detected: lazyRoute should not leave Suspense pending forever after chunk recovery.');
}

console.log('lazy-route-timeout-recovery-regression.test.mjs passed');
