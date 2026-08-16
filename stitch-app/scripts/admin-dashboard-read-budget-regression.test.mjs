import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'server', 'adminMetrics.js');
const source = await fs.readFile(adminPath, 'utf8');

if (source.includes('SELECT * FROM topics') || source.includes('FROM topics\n            ORDER')) {
  throw new Error('Admin dashboard should not full-scan topics table.');
}

if (!source.includes('LIMIT $1')) {
  throw new Error('Expected admin dashboard to keep recent lists bounded.');
}

const bannedFullScans = [
  'FROM session',
  'FROM "session"',
  'extracted_text',
  'credit_ledger',
  'FROM payments',
];

for (const snippet of bannedFullScans) {
  if (source.includes(snippet)) {
    throw new Error(`Admin dashboard should not query ${snippet} in the main snapshot.`);
  }
}

console.log('admin-dashboard-read-budget-regression.test.mjs passed');
