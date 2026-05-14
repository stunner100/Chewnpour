import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const cronsSource = readFileSync(resolve(rootDir, 'convex/crons.ts'), 'utf8');
const authConfigSource = readFileSync(resolve(rootDir, 'convex/authConfig.ts'), 'utf8');

assert.ok(
  cronsSource.includes('const ENABLE_SCHEDULED_EMAIL_CRONS = false;'),
  'Expected scheduled email crons to remain disabled.'
);

for (const cronName of [
  'streak email check',
  'weekly study summary',
  'product research outreach',
]) {
  const cronIndex = cronsSource.indexOf(cronName);
  const guardIndex = cronsSource.indexOf('if (ENABLE_SCHEDULED_EMAIL_CRONS)');
  assert.ok(cronIndex > guardIndex, `Expected "${cronName}" to be inside the disabled email cron guard.`);
}

assert.ok(
  authConfigSource.includes('const buildSignupWelcomeEmail = (params: { name: string }) =>')
    && authConfigSource.includes('databaseHooks:')
    && authConfigSource.includes('user: {')
    && authConfigSource.includes('create: {')
    && authConfigSource.includes('async after(user)')
    && authConfigSource.includes('context: "authSignupWelcome"'),
  'Expected signup-created users to receive the transactional welcome email.'
);

assert.ok(
  authConfigSource.includes('context: "authPasswordReset"'),
  'Expected password reset to remain a transactional auth email.'
);

console.log('email-cron-signup-only-regression tests passed');
