import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/lib/useVoicePlayback.js'), 'utf8');

for (const pattern of [
  'playsInline = true',
  'isAutoplayBlock',
  'Audio was blocked by your browser. Tap Play again.',
  'new Audio()',
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected mobile voice playback hardening to include "${pattern}".`);
  }
}

if (source.includes('convexSiteUrl') || source.includes('convex/react')) {
  throw new Error('Voice playback must stay Convex-free after the Supabase cutover.');
}

console.log('voice-mobile-playback-regression.test.mjs passed');
