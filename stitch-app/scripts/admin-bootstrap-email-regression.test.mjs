import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const adminSource = await fs.readFile(path.join(root, 'convex', 'admin.ts'), 'utf8');
const adminDashboardSource = await fs.readFile(path.join(root, 'src', 'pages', 'AdminDashboard.jsx'), 'utf8');

if (!adminSource.includes('const BOOTSTRAP_ADMIN_EMAILS = ["patrickannor35@gmail.com"];')) {
  throw new Error('Expected bootstrap admin email to be patrickannor35@gmail.com.');
}

if (adminSource.includes('const BOOTSTRAP_ADMIN_EMAILS = ["info@chewnpour.com"];')) {
  throw new Error('Bootstrap admin email should not be info@chewnpour.com.');
}

if (!adminDashboardSource.includes('Bootstrap admin includes')) {
  throw new Error('Expected admin dashboard to show bootstrap admin hint.');
}

if (!adminDashboardSource.includes('patrickannor35@gmail.com')) {
  throw new Error('Expected admin dashboard bootstrap hint to show patrickannor35@gmail.com.');
}

console.log('admin-bootstrap-email-regression.test.mjs passed');
