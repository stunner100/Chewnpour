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
  'ctx.db.query("assignmentMessages").collect()',
  'ctx.db.query("topicNotes").collect()',
  'ctx.db.query("topicChatMessages").collect()',
  'ctx.db.query("communityPosts").collect()',
  'ctx.db.query("libraryMaterials").collect()',
  'ctx.db.query("topicPodcasts").collect()',
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
  "case 'features':",
  '<FeatureUsagePanel snapshot={snapshot} activeUsersDays={activeUsersDays} />',
  'Feature Usage',
];

for (const snippet of dashboardRequiredSnippets) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for feature usage visibility.`);
  }
}

console.log('admin-feature-usage-regression.test.mjs passed');
