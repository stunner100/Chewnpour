import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const lessonTocSource = await read('src/components/lesson/LessonTOC.jsx');
const voicePlaybackSource = await read('src/lib/useVoicePlayback.js');

if (/node\.scrollIntoView\(\{ block: 'nearest' \}\)/.test(lessonTocSource)) {
  throw new Error('LessonTOC active item sync must not call element.scrollIntoView because it can scroll the lesson page away from the selected section.');
}

for (const expected of [
  'const scrollContainer = navRef.current;',
  'scrollContainer.scrollTo({',
  'behavior: \'smooth\'',
]) {
  if (!lessonTocSource.includes(expected)) {
    throw new Error(`Expected LessonTOC to keep active-item scrolling inside the TOC rail with "${expected}".`);
  }
}

if (!voicePlaybackSource.includes('const sourceUrl = await fetchRemoteAudioBlobUrl(streamUrl);')) {
  throw new Error('Voice playback must fetch remote stream URLs into blob URLs before assigning them to audio.src.');
}

if (/const sourceUrl = isMobileBrowser\s*\?\s*await fetchRemoteAudioBlobUrl\(streamUrl\)\s*:\s*streamUrl;/s.test(voicePlaybackSource)) {
  throw new Error('Voice playback must not use the remote stream URL directly on desktop.');
}

if (!voicePlaybackSource.includes('activeAudioObjectUrlRef.current = sourceUrl;')) {
  throw new Error('Voice playback must track fetched blob URLs so they can be revoked.');
}

console.log('topic-detail-controls-regression.test.mjs passed');
