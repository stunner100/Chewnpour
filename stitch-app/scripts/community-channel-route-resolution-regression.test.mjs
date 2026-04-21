import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const communityChannelPath = path.join(root, 'src', 'pages', 'CommunityChannel.jsx');
const communityChannelSource = await fs.readFile(communityChannelPath, 'utf8');

if (!/const CONVEX_ID_PATTERN = \/\^\[a-z0-9\]\{32\}\$\/;/.test(communityChannelSource)) {
  throw new Error('Expected CommunityChannel to distinguish Convex ids from seeded channel slugs.');
}

if (!/const slugifyChannelKey = \(value\) =>/.test(communityChannelSource)) {
  throw new Error('Expected CommunityChannel to normalize seeded channel titles into route slugs.');
}

if (!/const resolvedChannelId = useMemo\(\(\) => \{[\s\S]*slugifyChannelKey\(candidate\.title\) === slugifyChannelKey\(routeChannelId\)/m.test(communityChannelSource)) {
  throw new Error('Expected CommunityChannel to resolve seeded channel slugs before querying Convex.');
}

for (const queryName of ['getChannel', 'listPosts']) {
  const pattern = new RegExp(`api\\.community\\.${queryName},[\\s\\S]*resolvedChannelId \\? \\{ channelId: resolvedChannelId \\} : 'skip'`);
  if (!pattern.test(communityChannelSource)) {
    throw new Error(`Expected CommunityChannel to gate ${queryName} on resolvedChannelId.`);
  }
}

if (!/const isMissingChannel = resolvedChannelId === null \|\| channel === null;/.test(communityChannelSource)) {
  throw new Error('Expected CommunityChannel to treat unresolved slugs as a not-found state.');
}

console.log('community-channel-route-resolution-regression.test.mjs passed');
