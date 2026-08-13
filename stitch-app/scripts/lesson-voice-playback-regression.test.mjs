import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { splitLessonVoiceChunks } from '../src/lib/useVoicePlayback.js';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

assert.deepEqual(splitLessonVoiceChunks(''), []);
assert.deepEqual(splitLessonVoiceChunks('Short lesson.'), ['Short lesson.']);
assert.equal(splitLessonVoiceChunks('A'.repeat(900), 800).length > 1, true);

const hook = read('src/lib/useVoicePlayback.js');
const topicDetail = read('src/hooks/useTopicDetail.js');
const courseHttp = read('server/courseHttp.js');
const topicVoice = read('server/topicVoiceHttp.js');
const topicVoiceApi = read('api/topic-voice.js');
const vercel = read('vercel.json');
const speak = read('server/deepgramSpeak.js');
const toolbar = read('src/components/topic/TopicVoiceToolbar.jsx');

assert.match(speak, /\/v1\/speak/, 'Deepgram TTS must call the speak endpoint.');
assert.match(speak, /DEEPGRAM_VOICE_MODEL/, 'TTS must honor the configured Aura model.');
assert.match(speak, /DEEPGRAM_TIMEOUT_MS \|\| 20000/, 'Deepgram TTS must fail fast instead of hanging.');
assert.doesNotMatch(courseHttp, /parts\[1\] === "voice"/, 'Voice must not share the heavy topics router.');
assert.match(topicVoice, /callDeepgramSpeak/, 'Dedicated voice handler must synthesize with Deepgram.');
assert.match(topicVoiceApi, /maxDuration: 30/, 'Voice function must stay off the 300s anydoc isolate.');
assert.match(vercel, /"source": "\/api\/topic-voice"/, 'Vercel must bypass the catch-all router for TTS.');
assert.match(topicDetail, /fetch\('\/api\/topic-voice'/, 'Lesson play must POST to the dedicated voice function.');
assert.match(topicDetail, /Voice is taking too long\. Tap Play again/, 'Voice errors must not show raw terminated.');
assert.doesNotMatch(topicDetail, /Voice playback is temporarily unavailable/, 'Lesson voice must not stay parked.');
assert.match(hook, /playChunk/, 'Playback hook must play returned audio.');
assert.match(hook, /isPlaying: status === "playing"/, 'Toolbar play state must track HTML audio.');
assert.match(toolbar, /playVoice\(speechText\)/, 'Read aloud control must send the lesson text.');

console.log('lesson-voice-playback-regression: ok');
