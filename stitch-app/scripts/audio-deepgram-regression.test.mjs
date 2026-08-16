import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAudioUploadType,
  isDeepgramTranscribeEnabled,
} from '../server/deepgramTranscribe.js';
import { isAllowedStudyUploadType } from '../server/uploads.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

const uploadsSource = await read('server/uploads.js');
const deepgramSource = await read('server/deepgramTranscribe.js');
const uploadUi = await read('src/pages/UploadMaterials.jsx');

assert.match(deepgramSource, /callDeepgramTranscribe/, 'deepgram client required');
assert.match(uploadsSource, /tryDeepgramTranscribe/, 'finalize must transcribe audio');
assert.match(uploadsSource, /isAudioUploadType/, 'finalize must detect audio');
assert.match(uploadUi, /\.mp3/, 'upload UI must accept mp3');
assert.match(uploadUi, /FLAC/, 'upload UI copy must mention audio formats');

assert.equal(
  isAllowedStudyUploadType({
    fileType: 'mp3',
    contentType: 'audio/mpeg',
    fileName: 'lecture.mp3',
  }),
  true,
);
assert.equal(
  isAudioUploadType({
    fileType: 'mp3',
    contentType: 'audio/mpeg',
    fileName: 'lecture.mp3',
  }),
  true,
);
assert.equal(
  isAllowedStudyUploadType({
    fileType: 'png',
    contentType: 'image/png',
    fileName: 'scan.png',
  }),
  false,
);

const previous = process.env.DEEPGRAM_API_KEY;
delete process.env.DEEPGRAM_API_KEY;
assert.equal(isDeepgramTranscribeEnabled(), false);
process.env.DEEPGRAM_API_KEY = 'test';
assert.equal(isDeepgramTranscribeEnabled(), true);
if (previous === undefined) delete process.env.DEEPGRAM_API_KEY;
else process.env.DEEPGRAM_API_KEY = previous;

console.log('audio-deepgram-regression.test.mjs passed');
