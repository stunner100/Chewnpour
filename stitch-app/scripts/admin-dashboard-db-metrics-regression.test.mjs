import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'convex', 'admin.ts');
const source = await fs.readFile(adminPath, 'utf8');

const requiredSnippets = [
  'const isSuccessfulPayment = (payment: any) =>',
  'const isFailedPayment = (payment: any) =>',
  'const useSubscriptionRevenueFallback =',
  'source: useSubscriptionRevenueFallback',
  'const inferredTopicStats = uploads.reduce(',
  'const hasCourseRows = courses.length > 0;',
  'const hasTopicRows = topics.length > 0;',
  'courses: hasCourseRows ? "courses" : "uploads"',
  'topics: hasTopicRows ? "topics" : "uploads"',
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing admin DB-metrics regression guard: ${snippet}`);
  }
}

console.log('admin-dashboard-db-metrics-regression.test.mjs passed');
