import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  await fs.readFile(path.join(root, relativePath), 'utf8');

const appSource = await read('src/App.jsx');
for (const pattern of [
  "import('./pages/Community')",
  "import('./pages/CommunityChannel')",
]) {
  if (appSource.includes(pattern)) {
    throw new Error(`Community screen should not be mounted by App.jsx after the new-screen cutover: ${pattern}`);
  }
}

for (const pattern of [
  '<Route path="/dashboard/community" element={<Navigate to="/dashboard" replace />} />',
  '<Route path="/dashboard/community/:channelId" element={<Navigate to="/dashboard" replace />} />',
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected legacy community route redirect: ${pattern}`);
  }
}

const commandPaletteSource = await read('src/components/CommandPalette.jsx');
if (commandPaletteSource.includes('/dashboard/community')) {
  throw new Error('Command palette should not route users into the old community screen.');
}

const navSource = await read('src/components/MobileBottomNav.jsx');
if (navSource.includes('/dashboard/community')) {
  throw new Error('Mobile nav should not route users into the old community screen.');
}

const schemaSource = await read('convex/schema.ts');
for (const pattern of [
  'communityChannels: defineTable({',
  'communityMembers: defineTable({',
  'communityPosts: defineTable({',
  'communityFlags: defineTable({',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected community backend data to remain available: ${pattern}`);
  }
}

console.log('community-feature-regression.test.mjs passed');
