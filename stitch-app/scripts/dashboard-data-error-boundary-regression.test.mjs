import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const helperPath = path.join(root, 'src', 'lib', 'dashboardDataErrors.js');
const layoutPath = path.join(root, 'src', 'components', 'DashboardLayout.jsx');
const { getDashboardDataErrorMessage } = await import(pathToFileURL(helperPath).href);

const disabledMessage = getDashboardDataErrorMessage(
  new Error('You have exceeded the free plan limits, so your deployments have been disabled.'),
);

if (!disabledMessage.includes('configured Convex deployment is disabled')) {
  throw new Error('Expected disabled Convex deployments to get a specific dashboard recovery message.');
}

const genericMessage = getDashboardDataErrorMessage(new Error('Network request failed'));

if (!genericMessage.includes('could not reach your study data')) {
  throw new Error('Expected generic dashboard data failures to get a study data recovery message.');
}

const layoutSource = fs.readFileSync(layoutPath, 'utf8');
const requiredSnippets = [
  'DashboardContentErrorBoundary',
  'Study data unavailable',
  'captureSentryException',
  'key={routerLocation.pathname}',
  'cloud_off',
  'isChunkLoadError(error)',
  "attemptChunkRecoveryReload('dashboard-chunk-load')",
];

for (const snippet of requiredSnippets) {
  if (!layoutSource.includes(snippet)) {
    throw new Error(`Expected DashboardLayout.jsx to include ${snippet}.`);
  }
}

const wrapsDashboardChildren = /<DashboardContentErrorBoundary key=\{routerLocation\.pathname\}>[\s\S]*<BlurFade[\s\S]*\{children\}[\s\S]*<\/DashboardContentErrorBoundary>/.test(layoutSource);

if (!wrapsDashboardChildren) {
  throw new Error('Expected dashboard route children to render inside the dashboard content error boundary.');
}

console.log('dashboard-data-error-boundary-regression.test.mjs passed');
