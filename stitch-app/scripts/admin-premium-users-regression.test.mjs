import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const adminSource = await read('convex/admin.ts');
for (const snippet of [
  'const normalizeSubscriptionPlan = (value: unknown) =>',
  'const normalizeSubscriptionStatus = (value: unknown) =>',
  'const latestSubscriptionByUser = new Map<string, any>();',
  'premiumUsersTotal',
  'premiumUsersActive',
  'const premiumUsersBase = latestSubscriptions',
  'premiumUsers,',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for premium users dashboard support.`);
  }
}

const dashboardSource = await read('src/pages/AdminDashboard.jsx');
for (const snippet of [
  'label="Premium users"',
  'value={totals.premiumUsersActive}',
  'const UsersPanel = ({ signedInUsers, recentUsers, premiumUsers, flags }) => (',
  'SectionCard title="Premium Users"',
  'const premiumUsers = Array.isArray(snapshot.premiumUsers) ? snapshot.premiumUsers : [];',
  'premiumUsers={premiumUsers}',
]) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for premium user display.`);
  }
}

console.log('admin-premium-users-regression.test.mjs passed');
