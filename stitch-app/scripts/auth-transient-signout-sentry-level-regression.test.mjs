import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const authContextSource = readFileSync(
  resolve(root, 'src/contexts/AuthContext.jsx'),
  'utf8',
);

const signOutStart = authContextSource.indexOf('const signOut = async () => {');
assert.notEqual(signOutStart, -1, 'Expected AuthContext to define signOut.');

const updateProfileStart = authContextSource.indexOf('const updateProfile = async', signOutStart);
assert.notEqual(updateProfileStart, -1, 'Expected updateProfile after signOut.');

const signOutBlock = authContextSource.slice(signOutStart, updateProfileStart);

assert.match(
  signOutBlock,
  /const\s+transient\s*=\s*isTransientSessionError\(error\);/,
  'signOut should classify Better Auth failures as transient before reporting them.',
);

assert.match(
  signOutBlock,
  /level:\s*transient\s*\?\s*['"]warning['"]\s*:\s*['"]error['"]/,
  'Transient sign_out fetch failures should be captured as warnings so Sentry drops auth transport noise.',
);

console.log('auth-transient-signout-sentry-level-regression.test.mjs passed');
