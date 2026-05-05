import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  await fs.readFile(path.join(root, relativePath), 'utf8');

const publicShell = await read('src/components/PublicShell.jsx');
const landingPage = await read('src/pages/LandingPage.jsx');
const canvasCrowd = await read('src/components/blocks/CanvasCrowd.jsx');

assert.equal(
  publicShell.includes("import CanvasCrowd from './blocks/CanvasCrowd'"),
  true,
  'PublicShell must import the CanvasCrowd component used by production public pages.',
);

assert.equal(
  publicShell.includes('<CanvasCrowd height={240} />'),
  true,
  'PublicShell must render CanvasCrowd in its live footer.',
);

assert.equal(
  landingPage.includes("import CanvasCrowd from '../components/blocks/CanvasCrowd'"),
  true,
  'LandingPage must import CanvasCrowd for the production homepage footer.',
);

assert.equal(
  landingPage.includes('<CanvasCrowd height={260} />'),
  true,
  'LandingPage must render CanvasCrowd in the production homepage footer.',
);

assert.equal(
  canvasCrowd.includes('ctx.setTransform(dpr, 0, 0, dpr, 0, 0)'),
  true,
  'CanvasCrowd must reset the canvas transform on resize instead of accumulating scale.',
);

console.log('public-shell-canvas-crowd-regression.test.mjs passed');
