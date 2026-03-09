import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const schemaSource = await read('convex/schema.ts');
for (const snippet of [
  'userPresence: defineTable({',
  '.index("by_userId", ["userId"])',
  '.index("by_lastSeenAt", ["lastSeenAt"])',
]) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`Expected schema.ts to include "${snippet}" for user presence tracking.`);
  }
}

const profilesSource = await read('convex/profiles.ts');
for (const snippet of [
  'const PRESENCE_HEARTBEAT_MIN_INTERVAL_MS = 60 * 1000;',
  'export const touchPresence = mutation({',
  'query("userPresence")',
  'withIndex("by_userId", (q) => q.eq("userId", authenticatedUserId))',
]) {
  if (!profilesSource.includes(snippet)) {
    throw new Error(`Expected profiles.ts to include "${snippet}" for presence heartbeat.`);
  }
}

const adminSource = await read('convex/admin.ts');
for (const snippet of [
  'const ACTIVE_USERS_5M_WINDOW_MS = 5 * 60 * 1000;',
  'withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", fiveMinutesAgo))',
  'const activeUsersLast5Minutes = new Set(',
  'activeUsersLast5Minutes: activeUsersLast5Minutes.size,',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for active users 5-minute metric.`);
  }
}

const dashboardSource = await read('src/pages/AdminDashboard.jsx');
for (const snippet of [
  'label="Active (5m)"',
  'value={totals.activeUsersLast5Minutes}',
  'Heartbeat in last 5m',
]) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for active users UI.`);
  }
}

console.log('admin-active-users-5m-regression.test.mjs passed');
