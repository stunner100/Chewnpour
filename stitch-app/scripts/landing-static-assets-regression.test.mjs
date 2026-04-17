import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const landingPath = path.join(root, 'src', 'pages', 'LandingPage.jsx');
const landingSource = fs.readFileSync(landingPath, 'utf8');

const requiredAssets = [
  'public/chewnpourlogo.png',
  'public/favicon.svg',
  'public/chewnpour/img1.jpg',
  'public/chewnpour/img2.jpg',
  'public/chewnpour/img3.jpg',
  'public/chewnpour/img4.jpg',
];

for (const asset of requiredAssets) {
  const absolutePath = path.join(root, asset);
  assert.ok(fs.existsSync(absolutePath), `Expected landing asset to exist: ${asset}`);
}

for (const referencedPath of [
  '/chewnpourlogo.png',
  '/chewnpour/img1.jpg',
  '/chewnpour/img2.jpg',
  '/chewnpour/img3.jpg',
  '/chewnpour/img4.jpg',
]) {
  assert.ok(
    landingSource.includes(referencedPath),
    `Expected LandingPage.jsx to reference ${referencedPath}`
  );
}

const trackedFiles = new Set(
  execFileSync('git', ['ls-files', '--', ...requiredAssets], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
);

for (const asset of requiredAssets) {
  assert.ok(trackedFiles.has(asset), `Expected landing asset to be tracked in git: ${asset}`);
}

console.log('landing-static-assets-regression.test.mjs passed');
