import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dashboardPath = resolve(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const dashboardHeroPath = resolve(root, 'src', 'components', 'dashboard', 'DashboardHero.jsx');
const sourceFileCardPath = resolve(root, 'src', 'components', 'course', 'SourceFileCard.jsx');
const generatedCourseHeaderPath = resolve(root, 'src', 'components', 'course', 'GeneratedCourseHeader.jsx');
const courseTitlePath = resolve(root, 'src', 'lib', 'courseTitle.js');
const pipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const transcriptionClientPath = resolve(root, 'convex', 'lib', 'audioTranscriptionClient.ts');

const dashboardSource = readFileSync(dashboardPath, 'utf8');
const dashboardHeroSource = readFileSync(dashboardHeroPath, 'utf8');
const sourceFileCardSource = readFileSync(sourceFileCardPath, 'utf8');
const generatedCourseHeaderSource = readFileSync(generatedCourseHeaderPath, 'utf8');
const courseTitleSource = readFileSync(courseTitlePath, 'utf8');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const transcriptionClientSource = readFileSync(transcriptionClientPath, 'utf8');

for (const token of [
  "['audio/mpeg', 'mp3']",
  "['audio/x-m4a', 'm4a']",
  "['audio/wav', 'wav']",
  "['audio/webm', 'webm']",
  "getStudyUploadFileType(file)",
  "Please upload a PDF, PPTX, DOCX, or audio recording file",
]) {
  assert.ok(
    dashboardSource.includes(token),
    `Expected DashboardAnalysis.jsx to accept and normalize recording uploads via ${token}.`,
  );
}

assert.ok(
  dashboardHeroSource.includes('.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac,.flac,audio/*')
    && dashboardHeroSource.includes('class recordings')
    && dashboardHeroSource.includes('PDF, PPTX, DOCX, audio · Max 50MB'),
  'Expected dashboard upload CTA to advertise and accept recording files.',
);

assert.ok(
  sourceFileCardSource.includes('.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac,.flac,audio/*')
    && sourceFileCardSource.includes('audio recording files are supported')
    && sourceFileCardSource.includes("mp3: 'graphic_eq'"),
  'Expected course source uploads to accept and display recording files.',
);

assert.ok(
  generatedCourseHeaderSource.includes("mp3: 'AUDIO'")
    && generatedCourseHeaderSource.includes("mp3: 'uploaded recording'"),
  'Expected generated course header to label recordings clearly.',
);

assert.ok(
  courseTitleSource.includes('mp3|m4a|mp4|wav|webm|ogg|aac|flac'),
  'Expected course titles to strip audio recording extensions.',
);

for (const token of [
  'audio_transcript',
  'callDeepgramAudioTranscription',
  'runAudioTranscriptionCandidate',
  'isAudioFileType(args.fileType, args.fileName)',
  'backend: "audio"',
  'parser: "audio_transcript"',
  'deepgram_audio_transcription',
  'strictPass: true',
  'provisional: false',
]) {
  assert.ok(
    pipelineSource.includes(token),
    `Expected document extraction pipeline to route recordings through audio transcription via ${token}.`,
  );
}

assert.ok(
  transcriptionClientSource.includes('/v1/listen')
    && transcriptionClientSource.includes('DEEPGRAM_API_KEY')
    && transcriptionClientSource.includes('paragraphs: "true"')
    && transcriptionClientSource.includes('Deepgram transcription returned an empty transcript.'),
  'Expected audio transcription client to use Deepgram prerecorded transcription with paragraph output and explicit empty-transcript failure.',
);

console.log('audio-recording-upload-regression.test.mjs passed');
