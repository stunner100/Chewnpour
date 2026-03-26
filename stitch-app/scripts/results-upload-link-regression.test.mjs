import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = '/private/tmp/premium-promote-staging/stitch-app';
const resultsPagePath = path.join(repoRoot, 'src/pages/DashboardResults.jsx');
const source = fs.readFileSync(resultsPagePath, 'utf8');

assert.match(
  source,
  /<Link\s+[^>]*to="\/dashboard"[\s\S]*?>[\s\S]*?Upload Another Course[\s\S]*?<\/Link>/m,
  'Upload Another Course CTA should route to /dashboard',
);

assert.doesNotMatch(
  source,
  /<Link\s+[^>]*to="\/dashboard\/analysis"[\s\S]*?>[\s\S]*?Upload Another Course[\s\S]*?<\/Link>/m,
  'Upload Another Course CTA must not route to /dashboard/analysis',
);

console.log('results-upload-link-regression: ok');
