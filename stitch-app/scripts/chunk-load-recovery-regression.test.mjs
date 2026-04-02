import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const mainSource = await read('src/main.jsx');
const chunkRecoverySource = await read('src/lib/chunkLoadRecovery.js');
const appErrorBoundarySource = await read('src/components/AppErrorBoundary.jsx');
const appSource = await read('src/App.jsx');

for (const pattern of [
  'installChunkLoadRecovery',
  'vite:preloadError',
  'unhandledrejection',
  'attemptChunkRecoveryReload',
  'isChunkLoadError',
]) {
  if (!mainSource.includes(pattern)) {
    throw new Error(`Expected src/main.jsx to include "${pattern}" for chunk-load recovery.`);
  }
}

for (const pattern of [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'chunkloaderror',
  'loading chunk',
]) {
  if (!chunkRecoverySource.toLowerCase().includes(pattern)) {
    throw new Error(`Expected src/lib/chunkLoadRecovery.js to classify "${pattern}" as a recoverable chunk-load error.`);
  }
}

for (const pattern of [
  'navigator.serviceWorker.getRegistrations',
  'registration.unregister()',
  'window.caches.keys()',
  'window.caches.delete(key)',
  'window.location.reload()',
]) {
  if (!chunkRecoverySource.includes(pattern)) {
    throw new Error(`Expected chunk recovery to include hard-reload cleanup pattern "${pattern}".`);
  }
}

if (!/isChunkLoadError\(error\)\s*&&\s*attemptChunkRecoveryReload\('chunk-load'\)/.test(appErrorBoundarySource)) {
  throw new Error('Expected AppErrorBoundary to auto-reload once on chunk/module import failures.');
}

for (const pattern of [
  'ChunkRecoveryFallback',
  'if (attemptChunkRecoveryReload(routeName))',
  'We hit a stale app bundle while opening',
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected src/App.jsx to include "${pattern}" for lazy-route chunk mismatch recovery.`);
  }
}

console.log('chunk-load-recovery-regression.test.mjs passed');
