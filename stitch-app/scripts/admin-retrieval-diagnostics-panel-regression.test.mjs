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
  'export const getAdminAccessStatusInternal = internalQuery({',
  'export const diagnoseRetrievalForTopic = action({',
  'ctx.runQuery(internal.admin.getAdminAccessStatusInternal, {})',
  'ctx.runAction(internal.grounded.diagnoseSemanticRetrievalForTopic, {',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for admin retrieval diagnostics.`);
  }
}

for (const snippet of [
  'const diagnoseRetrievalForTopic = useAction(api.admin.diagnoseRetrievalForTopic);',
  'title="Retrieval Diagnostics"',
  'Inspect Topic Retrieval',
  'Vector backoff enabled',
  'Reranked Top',
]) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for retrieval diagnostics visibility.`);
  }
}

console.log('admin-retrieval-diagnostics-panel-regression.test.mjs passed');
