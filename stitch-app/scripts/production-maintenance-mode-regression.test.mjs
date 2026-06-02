import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const maintenanceModeSource = await read('src/lib/maintenance-mode.js');
const appProvidersSource = await read('src/bootstrap/AppProviders.jsx');
const maintenanceScreenSource = await read('src/components/MaintenanceScreen.jsx');
const mainSource = await read('src/main.jsx');
const envExampleSource = await read('.env.example');
const viteConfigSource = await read('vite.config.js');
const runbookSource = await read('docs/convex-sqlite-to-postgres-migration.md');
const todoSource = await read('tasks/todo.md');

if (!maintenanceModeSource.includes("import.meta.env.VITE_MAINTENANCE_MODE === 'true'")) {
  throw new Error('Expected maintenance-mode.js to use a direct build-time true flag.');
}

for (const snippet of [
  "import MaintenanceScreen from '../components/MaintenanceScreen.jsx';",
  "import { maintenanceModeEnabled } from '../lib/maintenance-mode.js';",
  'const convex = !maintenanceModeEnabled && hasConvexUrl ? new ConvexReactClient(convexUrl) : null;',
  'if (maintenanceModeEnabled) {',
  '<MaintenanceScreen />',
]) {
  if (!appProvidersSource.includes(snippet)) {
    throw new Error(`Expected AppProviders to gate normal app startup with maintenance mode: ${snippet}`);
  }
}

const maintenanceBranchIndex = appProvidersSource.indexOf('if (maintenanceModeEnabled) {');
const normalProviderIndex = appProvidersSource.indexOf('if (hasConvexUrl && convex) {');
if (maintenanceBranchIndex === -1 || normalProviderIndex === -1 || maintenanceBranchIndex > normalProviderIndex) {
  throw new Error('Expected AppProviders to render the maintenance screen before normal providers.');
}

for (const snippet of [
  'ChewnPour is under scheduled maintenance',
  'Please try again shortly',
  'We are moving the database to a more scalable setup',
]) {
  if (!maintenanceScreenSource.includes(snippet)) {
    throw new Error(`Expected maintenance screen copy: ${snippet}`);
  }
}

for (const forbidden of ['useEffect', 'setTimeout', 'setInterval', 'window.location', 'useQuery', 'useMutation', 'ConvexReactClient']) {
  if (maintenanceScreenSource.includes(forbidden)) {
    throw new Error(`Maintenance screen must stay static and avoid backend/app behavior: ${forbidden}`);
  }
}

for (const snippet of [
  "import MaintenanceScreen from './components/MaintenanceScreen.jsx';",
  "import { maintenanceModeEnabled } from './lib/maintenance-mode.js';",
  "import('./components/AppErrorBoundary.jsx')",
  "import('./bootstrap/AppProviders.jsx')",
  'if (maintenanceModeEnabled) {',
  '  renderMaintenanceApp();',
  '  renderNormalApp();',
  '  applyNetworkHints();',
  '  scheduleObservabilityInit();',
  "import('./lib/sentry.js')",
  "import('./lib/posthog.js')",
]) {
  if (!mainSource.includes(snippet)) {
    throw new Error(`Expected main.jsx to skip network and observability startup in maintenance mode: ${snippet}`);
  }
}

for (const forbidden of [
  "import AppErrorBoundary from './components/AppErrorBoundary.jsx';",
  "import AppProviders from './bootstrap/AppProviders.jsx';",
  "import { initSentry } from './lib/sentry.js';",
  "import { initPostHog } from './lib/posthog.js';",
]) {
  if (mainSource.includes(forbidden)) {
    throw new Error(`Expected main.jsx to lazy-load observability outside maintenance mode: ${forbidden}`);
  }
}

const mainRuntimeBranch = mainSource.slice(mainSource.lastIndexOf('if (maintenanceModeEnabled) {'));
if (!mainRuntimeBranch.includes(`if (maintenanceModeEnabled) {
  renderMaintenanceApp();
} else {
  renderNormalApp();
  applyNetworkHints();
  scheduleObservabilityInit();
}`)) {
  throw new Error('Expected main.jsx to keep network and observability startup in the normal runtime branch.');
}

if (!/^VITE_MAINTENANCE_MODE=false$/m.test(envExampleSource)) {
  throw new Error('Expected .env.example to document VITE_MAINTENANCE_MODE=false.');
}

for (const snippet of [
  "const resolvedMaintenanceMode = String(env.VITE_MAINTENANCE_MODE || '').trim()",
  "'import.meta.env.VITE_MAINTENANCE_MODE': JSON.stringify(resolvedMaintenanceMode)",
]) {
  if (!viteConfigSource.includes(snippet)) {
    throw new Error(`Expected vite config to inject maintenance mode at build time: ${snippet}`);
  }
}

for (const snippet of [
  'VITE_MAINTENANCE_MODE=true',
  '/api/v1/pause_deployment',
  '/api/v1/unpause_deployment',
  'doctl compute droplet-action resize 566121482',
  '--resize-disk',
  'already-included `160 GB`',
  'VITE_MAINTENANCE_MODE=false',
]) {
  if (!runbookSource.includes(snippet)) {
    throw new Error(`Expected runbook to document the maintenance cutover step: ${snippet}`);
  }
}

for (const snippet of [
  'Production Maintenance Screen And Pause Readiness',
  'staging pause rehearsal',
  'Production remains SQLite-backed',
]) {
  if (!todoSource.includes(snippet)) {
    throw new Error(`Expected todo evidence for maintenance readiness: ${snippet}`);
  }
}

console.log('production-maintenance-mode-regression.test.mjs passed');
