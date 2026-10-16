import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sign-up states the Terms/Privacy consent and requires 8+ character passwords,
// matching the server-side Better Auth minimum.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const signUp = read('src/pages/SignUp.jsx');
const auth = read('server/auth.js');

assert.match(auth, /emailAndPassword: \{[\s\S]*?minPasswordLength: 8,/, 'Better Auth must enforce an 8-character minimum');
assert.match(signUp, /password\.length < 8/);
assert.match(signUp, /Password must be at least 8 characters/);
assert.match(signUp, /minLength=\{8\}/);
assert.match(signUp, /placeholder="At least 8 characters"/);
assert.doesNotMatch(signUp, /At least 6 characters|minLength=\{6\}|password\.length < 6/);

assert.match(signUp, /By creating an account, you agree to our/);
assert.match(signUp, /<Link to="\/terms"[^>]*>\s*Terms of Service\s*<\/Link>/);
assert.match(signUp, /<Link to="\/privacy"[^>]*>\s*Privacy Policy\s*<\/Link>/);

console.log('signup-consent-password-regression.test.mjs passed');
