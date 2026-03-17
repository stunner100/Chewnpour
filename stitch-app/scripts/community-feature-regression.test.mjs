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
  'path="/dashboard/community"',
  'path="/dashboard/community/:channelId"',
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected App.jsx to include "${pattern}".`);
  }
}

const navSource = await read('src/components/MobileBottomNav.jsx');
for (const pattern of [
  "label: 'Community'",
  "path: '/dashboard/community'",
]) {
  if (!navSource.includes(pattern)) {
    throw new Error(`Expected MobileBottomNav.jsx to include "${pattern}".`);
  }
}

const dashboardSource = await read('src/pages/DashboardAnalysis.jsx');
for (const pattern of [
  'autoJoinCommunity',
  'api.community.autoJoinOnUpload',
  "to=\"/dashboard/community\"",
]) {
  if (!dashboardSource.includes(pattern)) {
    throw new Error(`Expected DashboardAnalysis.jsx to include "${pattern}".`);
  }
}

const communityPageSource = await read('src/pages/Community.jsx');
for (const pattern of [
  'api.community.listChannels',
  'api.community.getUserChannels',
  '/dashboard/community/${channel._id}',
]) {
  if (!communityPageSource.includes(pattern)) {
    throw new Error(`Expected Community.jsx to include "${pattern}".`);
  }
}

const communityChannelSource = await read('src/pages/CommunityChannel.jsx');
for (const pattern of [
  'api.community.getChannel',
  'api.community.listPosts',
  'api.community.joinChannel',
  'api.community.createPost',
  'api.community.getWeeklyLeaderboard',
]) {
  if (!communityChannelSource.includes(pattern)) {
    throw new Error(`Expected CommunityChannel.jsx to include "${pattern}".`);
  }
}

const schemaSource = await read('convex/schema.ts');
for (const pattern of [
  'communityChannels: defineTable({',
  'communityMembers: defineTable({',
  'communityPosts: defineTable({',
  'communityFlags: defineTable({',
  '.index("by_courseId", ["courseId"])',
  '.index("by_channelId_userId", ["channelId", "userId"])',
  '.index("by_channelId_createdAt", ["channelId", "createdAt"])',
  '.index("by_userId_postId", ["userId", "postId"])',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected schema.ts to include "${pattern}".`);
  }
}

const communityConvexSource = await read('convex/community.ts');
for (const pattern of [
  'export const listChannels = query({',
  'export const getUserChannels = query({',
  'export const getWeeklyLeaderboard = query({',
  'export const joinChannel = mutation({',
  'export const createPost = mutation({',
  'export const autoJoinOnUpload = mutation({',
]) {
  if (!communityConvexSource.includes(pattern)) {
    throw new Error(`Expected community.ts to include "${pattern}".`);
  }
}

const apiSource = await read('convex/_generated/api.d.ts');
if (!apiSource.includes('community: typeof community;')) {
  throw new Error('Expected generated Convex API bindings to include the community module.');
}

console.log('community-feature-regression.test.mjs passed');
