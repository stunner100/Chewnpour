import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appSource = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');

for (const pattern of [
  'const lazyRoute = (importer, { componentName, namedExport } = {}) => lazy(() =>',
  'if (mod?.default) return mod;',
  'const exportCandidates = [namedExport, componentName]',
  'attemptChunkRecoveryReload(routeName)',
  "const DashboardProcessing = lazyRoute(() => import('./pages/DashboardProcessing')",
  "componentName: 'DashboardProcessing'",
  "namedExport: 'DashboardProcessing'",
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected App.jsx to include "${pattern}" for robust lazy route recovery.`);
  }
}

console.log('dashboard-processing-lazy-recovery-regression.test.mjs passed');
