import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const playbackSource = await read('src/lib/useVoicePlayback.js');
const topicDetailSource = await read('src/hooks/useTopicDetail.js');

if (playbackSource.includes('convexSiteUrl') || playbackSource.includes('VITE_CONVEX_SITE_URL')) {
  throw new Error('Voice playback must not resolve Convex site URLs after the cutover.');
}

if (!topicDetailSource.includes("fetch('/api/topic-voice'")) {
  throw new Error('Expected lesson voice to stream from /api/topic-voice.');
}

console.log('voice-stream-site-url-regression.test.mjs passed');
