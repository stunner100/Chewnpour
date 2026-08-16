import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const courseHttp = await fs.readFile(path.join(root, 'server/courseHttp.js'), 'utf8');
const topicDetail = await fs.readFile(path.join(root, 'src/hooks/useTopicDetail.js'), 'utf8');

if (topicDetail.includes('voice/stream?token=') || courseHttp.includes('VOICE_STREAM_SIGNING_SECRET')) {
  throw new Error('Lesson voice must use the authenticated topics API instead of Convex stream tokens.');
}

if (!topicDetail.includes('credentials: \'include\'') || !topicDetail.includes('/api/topic-voice')) {
  throw new Error('Expected lesson voice requests to send the session cookie to /api/topic-voice.');
}

console.log('voice-stream-token-regression.test.mjs passed');
