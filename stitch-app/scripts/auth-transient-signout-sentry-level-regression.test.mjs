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
  /operation:\s*'sign_out'/,
  'signOut should report Better Auth failures through captureAuthFailure.',
);

assert.match(
  signOutBlock,
  /level:\s*isTransientSessionError\(error\)\s*\?\s*['"]warning['"]\s*:\s*['"]error['"]/,
  'Transient sign_out fetch failures should be captured as warnings so Sentry drops auth transport noise.',
);

console.log('auth-transient-signout-sentry-level-regression.test.mjs passed');
