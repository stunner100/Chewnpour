import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const topicDetailSource = await fs.readFile(topicDetailPath, 'utf8');

if (!/useConvexAuth,\s*useQuery,\s*useAction,\s*useMutation/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to import useConvexAuth from convex/react.');
}

if (!/const\s+\{\s*isAuthenticated:\s*isConvexAuthenticated\s*\}\s*=\s*useConvexAuth\(\);/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to read isConvexAuthenticated from useConvexAuth().');
}

if (!/api\.subscriptions\.getVoiceGenerationQuotaStatus,\s*[\r\n\s]*user\?\.id\s*&&\s*isConvexAuthenticated\s*\?\s*\{\}\s*:\s*'skip'/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to gate getVoiceGenerationQuotaStatus behind user.id and isConvexAuthenticated.');
}

console.log('topic-detail-auth-gating-regression.test.mjs passed');
