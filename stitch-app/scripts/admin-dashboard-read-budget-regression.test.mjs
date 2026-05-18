import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'convex', 'admin.ts');
const source = await fs.readFile(adminPath, 'utf8');

if (source.includes('ctx.db.query("topics").collect()')) {
  throw new Error('Admin dashboard should not full-scan topics table; this can exceed Convex read limits.');
}

if (!source.includes('const topics: any[] = [];')) {
  throw new Error('Expected admin dashboard to keep topic aggregation in lightweight mode.');
}

const snapshotStart = source.indexOf('export const getDashboardSnapshot = query({');
const snapshotEnd = source.indexOf('\\n});', snapshotStart);
const snapshotSource = source.slice(snapshotStart, snapshotEnd);

const bannedFullScans = [
  'assignmentMessages',
  'examAttempts',
  'conceptAttempts',
  'topicNotes',
  'topicChatMessages',
  'communityPosts',
  'libraryMaterials',
  'topicPodcasts',
  'userPresence',
  'campaignCreditGrants',
  'campaignLandingEvents',
];

for (const tableName of bannedFullScans) {
  const fullScan = `ctx.db.query("${tableName}").collect()`;
  if (snapshotSource.includes(fullScan)) {
    throw new Error(
      `Admin dashboard should not full-scan ${tableName}; load bounded rows or a tab-specific query instead.`
    );
  }
}

if (snapshotSource.includes('model: "session"')) {
  throw new Error('Admin dashboard should not query Better Auth sessions in the main snapshot; it floods logs and can exceed read limits.');
}

if (snapshotSource.includes('fetchAuthUsersByIds(ctx,')) {
  throw new Error('Admin dashboard should not enrich Better Auth users in the main snapshot; use tab-specific queries instead.');
}

console.log('admin-dashboard-read-budget-regression.test.mjs passed');
