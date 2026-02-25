import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const source = await fs.readFile(indexPath, 'utf8');

for (const snippet of [
  '<meta property="og:type" content="website" />',
  '<meta property="og:title" content="ChewnPour" />',
  '<meta property="og:description" content="Turn your slides into smart lessons and quizzes." />',
  '<meta property="og:url" content="https://www.chewnpour.com/" />',
  '<meta property="og:image" content="https://www.chewnpour.com/icons/icon-512x512.png" />',
]) {
  if (!source.includes(snippet)) {
    throw new Error(`Expected index.html to include: ${snippet}`);
  }
}

console.log('landing-og-meta-regression.test.mjs passed');
