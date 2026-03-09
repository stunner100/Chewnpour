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

console.log('admin-dashboard-read-budget-regression.test.mjs passed');
