import fs from 'node:fs/promises';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const read = async (relativePath) => {
  const filePath = path.join(root.pathname, relativePath);
  return fs.readFile(filePath, 'utf8');
};

const [dashboardSource, conceptsSource] = await Promise.all([
  read('src/pages/DashboardAnalysis.jsx'),
  read('convex/concepts.ts'),
]);

if (!dashboardSource.includes('api.concepts.getConceptReviewQueue')) {
  throw new Error('Expected dashboard analysis to query concepts.getConceptReviewQueue.');
}

if (!/export const getConceptReviewQueue = query\(/.test(conceptsSource)) {
  throw new Error('Expected Convex concepts module to export getConceptReviewQueue.');
}

if (!conceptsSource.includes('withIndex("by_userId_nextReviewAt"')) {
  throw new Error('Expected concept review queue to read conceptMastery via by_userId_nextReviewAt.');
}

console.log('dashboard-concept-review-queue-regression.test.mjs passed');
