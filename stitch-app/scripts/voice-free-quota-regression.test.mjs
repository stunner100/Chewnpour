import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const playbackSource = await read('src/lib/useVoicePlayback.js');
const topicDetailSource = await read('src/hooks/useTopicDetail.js');
const courseHttp = await read('server/courseHttp.js');

if (playbackSource.includes('isVoiceQuotaExceededMessage') || topicDetailSource.includes('getVoiceGenerationQuotaStatus')) {
  throw new Error('Lesson voice must not keep the Convex free-quota path after the cutover.');
}

if (!courseHttp.includes('parts[1] === "voice"') || !courseHttp.includes('callDeepgramSpeak')) {
  throw new Error('Expected authenticated /api/topics/:id/voice to synthesize lesson audio.');
}

if (!topicDetailSource.includes('body: JSON.stringify({ text: spoken })')) {
  throw new Error('Expected the lesson play control to send lesson text to the voice API.');
}

console.log('voice-free-quota-regression.test.mjs passed');
