import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const targetPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const source = await fs.readFile(targetPath, 'utf8');

if (!/useConvexAuth/.test(source)) {
  throw new Error('Expected DashboardAnalysis.jsx to import/use useConvexAuth.');
}

if (!/api\.exams\.getUserPerformanceInsights/.test(source)) {
  throw new Error('Expected DashboardAnalysis.jsx to query api.exams.getUserPerformanceInsights.');
}

if (!/isConvexAuthenticated\s*\?\s*\{\s*\}\s*:\s*'skip'/.test(source)) {
  throw new Error(
    'Expected getUserPerformanceInsights query to be gated by isConvexAuthenticated only.'
  );
}

console.log('performance-insights-auth-gating-regression.test.mjs passed');
