/**
 * Gemini Live post-lesson oral tutor prototype.
 *
 * Run: node scripts/live-tutor-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildLiveTutorPrompt,
    isLiveTutorEnabled,
    LIVE_TUTOR_MAX_EXCERPT,
} from '../server/liveTutor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const courseHttp = read('server/courseHttp.js');
const liveTutor = read('server/liveTutor.js');
const completion = read('src/components/study/LessonCompletion.jsx');
const stepper = read('src/components/lesson/LessonSectionStepper.jsx');
const panel = read('src/components/study/LiveTutorPanel.jsx');
const hook = read('src/hooks/useGeminiLiveTutor.js');
const envExample = read('.env.example');
const packageJson = read('package.json');

assert.match(courseHttp, /createLiveTutorSession/, 'topics handler must mint live tutor sessions');
assert.match(courseHttp, /parts\[1\] === "live-tutor"/, 'POST /api/topics/:id/live-tutor must be routed');
assert.match(liveTutor, /authTokens\.create/, 'server must mint an ephemeral Gemini token');
assert.match(liveTutor, /liveConnectConstraints/, 'token must lock the live session config');
assert.match(liveTutor, /systemInstruction/, 'lesson prompt must stay on the server');

assert.match(liveTutor, /token: name/, 'response must include the ephemeral token name');
assert.match(liveTutor, /expiresAt: expireTime/, 'response must include expiry');
assert.doesNotMatch(
    liveTutor.slice(liveTutor.indexOf('return {'), liveTutor.indexOf('};', liveTutor.indexOf('return {')) + 2),
    /GEMINI_API_KEY|apiKey/,
    'token response must not include the Gemini API key',
);

assert.match(packageJson, /"@google\/genai"/, 'client and server must depend on the Gemini SDK');
assert.match(envExample, /LIVE_TUTOR_ENABLED=false/, 'server flag must default off');
assert.match(envExample, /VITE_LIVE_TUTOR_ENABLED=false/, 'UI flag must default off');
assert.match(envExample, /GEMINI_LIVE_MODEL=gemini-3\.8-live/, 'live model must be documented');

const vercelJson = read('vercel.json');
assert.match(vercelJson, /microphone=\(self\)/, 'production must allow the oral-review microphone');

assert.match(completion, /isLiveTutorUiEnabled/, 'completion must gate the live tutor card');
assert.match(completion, /Start quiz/, 'completion must still lead into the quiz');
assert.match(completion, /LiveTutorPanel/, 'completion must mount the oral review card when enabled');
assert.match(stepper, /topicId=\{topicId\}/, 'stepper must pass the topic id into completion');
assert.match(panel, /Start oral review/, 'panel must require a click before the mic starts');
assert.match(panel, /LiveTutorOrb/, 'oral review must show an audio-reactive tutor orb');
assert.match(panel, /data-live-caption/, 'tutor speech must stream into the transcript list');
assert.match(panel, /liveCaption/, 'panel must render the playback-synced caption in history');
assert.doesNotMatch(panel, /live-tutor-caption/, 'tutor words must not overlay the orb');
assert.match(hook, /\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/live-tutor/, 'hook must mint via the topics API');
assert.match(hook, /sendRealtimeInput\(\{ text: KICKOFF_TEXT \}\)/, 'session must kick off the first question');
assert.match(hook, /audio\/pcm;rate=16000/, 'mic audio must be 16kHz PCM');
assert.match(hook, /createPcmPlayer/, 'Gemini PCM must play through the local PCM player');
assert.match(hook, /voiceLevelRef/, 'orb amplitude must follow live PCM energy');
assert.match(hook, /onIdle/, 'listening must wait until tutor playback actually ends');
assert.match(hook, /revealedCaption/, 'tutor captions must reveal with PCM progress');
assert.match(hook, /liveCaption/, 'speaking words must stream from playback-synced captions');
assert.match(hook, /queuedAudioRef/, 'captions must wait for queued tutor audio before committing a turn');
assert.match(hook, /inputTranscription/, 'learner speech must freeze the current tutor line into history');
assert.doesNotMatch(
    hook,
    /appendTranscription\(current, 'assistant', content\.outputTranscription/,
    'Gemini output transcription must not dump into history ahead of speech',
);
assert.doesNotMatch(hook, /GEMINI_API_KEY/, 'browser must never see the long-lived Gemini key');
assert.doesNotMatch(packageJson, /talkinghead/, '3D talking avatar must not remain a client dependency');

const orb = read('src/components/study/LiveTutorOrb.jsx');
const energy = read('src/lib/liveTutorEnergy.js');
const audio = read('src/lib/liveTutorAudio.js');
assert.match(orb, /dataset\.voiceLevel/, 'orb must expose live amplitude for the speaking glow');
assert.match(energy, /voiceLevelFromRms/, 'orb energy must come from PCM amplitude');
assert.match(audio, /onLevel/, 'PCM playback must report amplitude to the orb');
assert.match(audio, /getProgress/, 'PCM player must expose utterance progress for captions');
assert.match(audio, /utteranceStart/, 'progress must start when the first chunk of an utterance queues');

const previousFlag = process.env.LIVE_TUTOR_ENABLED;
const previousKey = process.env.GEMINI_API_KEY;
delete process.env.LIVE_TUTOR_ENABLED;
delete process.env.GEMINI_API_KEY;
assert.equal(isLiveTutorEnabled(), false, 'live tutor must stay off without the flag and key');
process.env.LIVE_TUTOR_ENABLED = previousFlag;
process.env.GEMINI_API_KEY = previousKey;

const longExcerpt = 'x'.repeat(LIVE_TUTOR_MAX_EXCERPT + 400);
const prompt = buildLiveTutorPrompt({
    title: 'Working memory',
    content: `# Encoding\n\n${longExcerpt}\n\n# Quick check\n\nDo not send this.`,
});
assert.match(prompt, /ask 4 to 6 short spoken questions/i);
assert.match(prompt, /RESPOND UNMISTAKABLY IN ENGLISH/);
assert.match(prompt, /Stay in English for the whole review/);
assert.match(prompt, /LESSON TITLE: Working memory/);
assert.match(prompt, /- Encoding/);
assert.doesNotMatch(prompt, /Quick check/, 'noise sections must not be sent to the live tutor');
const excerptMatch = prompt.match(/Excerpt: ([x]+)/);
assert.ok(excerptMatch, 'prompt must include a truncated excerpt');
assert.equal(excerptMatch[1].length, LIVE_TUTOR_MAX_EXCERPT);
assert.ok(!prompt.includes('x'.repeat(LIVE_TUTOR_MAX_EXCERPT + 1)));

console.log('live-tutor-regression.test.mjs passed');
