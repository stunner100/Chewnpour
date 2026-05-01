import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const httpSource = await fs.readFile(path.join(root, 'convex', 'http.ts'), 'utf8');

const requiredOrigins = [
  'https://www.chewnpour.com',
  'https://chewnpour.com',
  'https://staging.chewnpour.com',
];

for (const origin of requiredOrigins) {
  if (!httpSource.includes(origin)) {
    throw new Error(`Missing Better Auth CORS origin: ${origin}`);
  }
}

if (!/allowedOrigins:\s*AUTH_CORS_ALLOWED_ORIGINS/.test(httpSource)) {
  throw new Error('Expected Better Auth HTTP routes to use AUTH_CORS_ALLOWED_ORIGINS.');
}

console.log('auth-cors-origins-regression.test.mjs passed');
