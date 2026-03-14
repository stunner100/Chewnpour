import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'convex', 'admin.ts');
const dashboardPath = path.join(root, 'src', 'pages', 'AdminDashboard.jsx');

const [adminSource, dashboardSource] = await Promise.all([
  fs.readFile(adminPath, 'utf8'),
  fs.readFile(dashboardPath, 'utf8'),
]);

for (const snippet of [
  'ctx.db.query("aiMessageUsage").collect()',
  'const historicalLlmEstimateByUser = new Map<string, {',
  'historicalLlmEstimateAnalytics: {',
  'estimatedAiMessageTokensPerRequest:',
  'estimatedHumanizerTokensPerRequest:',
  'estimatedHistoricalTokensTotal:',
  'estimatedHistoricalTokensLastWindow:',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for historical LLM estimates.`);
  }
}

for (const snippet of [
  'label="Hist. token est."',
  'const historicalLlmEstimate = snapshot.historicalLlmEstimateAnalytics || {};',
  'label="Historical est. total"',
  'Historical AI messages',
  'Historical humanizer',
  'Hist. est.',
]) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for historical estimate visibility.`);
  }
}

console.log('admin-llm-historical-estimates-regression.test.mjs passed');
