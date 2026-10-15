import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const authSource = await fs.readFile(path.join(root, 'server', 'auth.js'), 'utf8');

const productionOriginsBlock = authSource.match(/const PRODUCTION_ORIGINS = \[([\s\S]*?)\];/);
if (!productionOriginsBlock) {
  throw new Error('Expected server/auth.js to define PRODUCTION_ORIGINS.');
}

for (const origin of [
  'https://www.chewnpour.com',
  'https://chewnpour.com',
  'https://staging.chewnpour.com',
]) {
  if (!productionOriginsBlock[1].includes(`"${origin}"`)) {
    throw new Error(`Missing Better Auth trusted origin: ${origin}`);
  }
}

if (!/trustedOrigins: async \(request\) => \{[\s\S]*?\.\.\.PRODUCTION_ORIGINS,/.test(authSource)) {
  throw new Error('Expected Better Auth trustedOrigins to include PRODUCTION_ORIGINS.');
}

console.log('auth-cors-origins-regression.test.mjs passed');
