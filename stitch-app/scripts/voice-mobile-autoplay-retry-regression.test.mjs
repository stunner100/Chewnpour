import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/lib/useVoicePlayback.js'), 'utf8');

for (const pattern of [
  'data:audio/wav;base64,',
  'audio.muted = true',
  'await audio.play()',
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected mobile autoplay retry hardening to include "${pattern}".`);
  }
}

console.log('voice-mobile-autoplay-retry-regression.test.mjs passed');
