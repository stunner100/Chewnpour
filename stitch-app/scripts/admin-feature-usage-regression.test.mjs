import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const read = (filePath) => fs.readFile(path.join(root, filePath), 'utf8');

const [adminSource, dashboardSource] = await Promise.all([
  read('convex/admin.ts'),
  read('src/pages/AdminDashboard.jsx'),
]);

const adminRequiredSnippets = [
  'const buildFeatureUsageAnalytics = (',
  'featureUsageAnalytics',
  'collectRecentRows(ctx, "assignmentMessages")',
  'collectRecentRows(ctx, "topicNotes")',
  'collectRecentRows(ctx, "topicChatMessages")',
  'collectRecentRows(ctx, "communityPosts")',
  'collectRecentRows(ctx, "libraryMaterials")',
  'collectRecentRows(ctx, "topicPodcasts")',
  'key: "library_materials"',
  'key: "community_posts"',
  'key: "podcasts"',
];

for (const snippet of adminRequiredSnippets) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for feature usage analytics.`);
  }
}

const dashboardRequiredSnippets = [
  "{ key: 'features', label: 'Features', icon: 'analytics' }",
  'const FeatureUsagePanel = ({ snapshot, activeUsersDays }) =>',
  'snapshot.featureUsageAnalytics',
  "activeTab === 'features'",
  '<FeatureUsagePanel snapshot={snapshot} activeUsersDays={activeUsersDays} />',
  'Feature Usage',
];

for (const snippet of dashboardRequiredSnippets) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for feature usage visibility.`);
  }
}

console.log('admin-feature-usage-regression.test.mjs passed');
