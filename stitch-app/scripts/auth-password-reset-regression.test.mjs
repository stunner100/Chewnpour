import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isResendConfigured } from '../server/email.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

const authSource = await read('server/auth.js');
const emailSource = await read('server/email.js');
const loginSource = await read('src/pages/Login.jsx');
const resetSource = await read('src/pages/ResetPassword.jsx');
const envExample = await read('.env.example');

assert.match(authSource, /sendResetPassword/, 'auth must wire sendResetPassword');
assert.match(authSource, /sendPasswordResetEmail/, 'auth must send via Resend helper');
assert.match(emailSource, /from "resend"/, 'email helper uses Resend SDK');
assert.match(envExample, /RESEND_API_KEY/, 'env example documents Resend key');
assert.match(envExample, /RESEND_FROM/, 'env example documents Resend from');
assert.match(loginSource, /Forgot password\?/, 'login restores forgot-password link');
assert.match(resetSource, /requestPasswordReset/, 'reset page can request email');
assert.match(resetSource, /resetPassword/, 'reset page can set new password');
assert.doesNotMatch(resetSource, /Password reset unavailable/, 'stub copy must be removed');

const previousKey = process.env.RESEND_API_KEY;
const previousFrom = process.env.RESEND_FROM;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM;
assert.equal(isResendConfigured(), false);
process.env.RESEND_API_KEY = 'test_key';
process.env.RESEND_FROM = 'ChewnPour <noreply@example.com>';
assert.equal(isResendConfigured(), true);
if (previousKey === undefined) delete process.env.RESEND_API_KEY;
else process.env.RESEND_API_KEY = previousKey;
if (previousFrom === undefined) delete process.env.RESEND_FROM;
else process.env.RESEND_FROM = previousFrom;

console.log('auth-password-reset-regression.test.mjs passed');
