import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRecoverableOAuthErrorCode,
  messageForOAuthErrorCode,
  oauthErrorCodeFromSearchParams,
  stripOAuthErrorParams,
} from '../src/lib/oauthErrorMessage.js';
import {
  buildGoogleContinueHtml,
  isGoogleAuthorizationUrl,
  loginErrorLocation,
  sanitizeCallbackPath,
} from '../server/googleOAuthStartUtils.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (rel) => fs.readFile(path.join(root, rel), 'utf8');

assert.equal(sanitizeCallbackPath('/dashboard'), '/dashboard');
assert.equal(sanitizeCallbackPath('/dashboard?next=1'), '/dashboard?next=1');
assert.equal(sanitizeCallbackPath('https://www.chewnpour.com/dashboard'), '/dashboard');
assert.equal(sanitizeCallbackPath('https://evil.example/dashboard'), '/dashboard');
assert.equal(sanitizeCallbackPath('//evil.example'), '/dashboard');
assert.equal(sanitizeCallbackPath('/\\evil.example'), '/dashboard');
assert.equal(sanitizeCallbackPath('javascript:alert(1)'), '/dashboard');
assert.equal(sanitizeCallbackPath(''), '/dashboard');

assert.equal(
  loginErrorLocation('https://www.chewnpour.com', 'please_restart_the_process'),
  'https://www.chewnpour.com/login?error=please_restart_the_process',
);
assert.equal(
  loginErrorLocation('', 'state_mismatch'),
  '/login?error=state_mismatch',
);

assert.equal(isGoogleAuthorizationUrl('https://accounts.google.com/o/oauth2/v2/auth?x=1'), true);
assert.equal(isGoogleAuthorizationUrl('https://evil.example/o/oauth2/v2/auth'), false);
assert.equal(isGoogleAuthorizationUrl('javascript:alert(1)'), false);

const html = buildGoogleContinueHtml('https://accounts.google.com/o/oauth2/v2/auth?state=abc');
assert.match(html, /window\.location\.replace\("https:\/\/accounts\.google.com\/o\/oauth2\/v2\/auth\?state=abc"\)/);
assert.match(html, /<noscript><meta http-equiv="refresh" content="0;url=https:\/\/accounts\.google.com\/o\/oauth2\/v2\/auth\?state=abc"><\/noscript>/);
assert.equal(
  (html.match(/<meta http-equiv="refresh"/g) || []).length,
  1,
  'google-start must not auto-redirect twice with the same OAuth state',
);
assert.doesNotMatch(
  html.replace(/<noscript>[\s\S]*?<\/noscript>/g, ''),
  /http-equiv="refresh"/,
  'meta-refresh must not run in JS browsers (keep it inside noscript)',
);

const params = new URLSearchParams('error=please_restart_the_process&ref=ABC');
assert.equal(oauthErrorCodeFromSearchParams(params), 'please_restart_the_process');
assert.equal(
  messageForOAuthErrorCode('please_restart_the_process'),
  'Google sign-in was interrupted. Please try again.',
);
assert.equal(messageForOAuthErrorCode('access_denied'), 'Google sign-in was cancelled.');
assert.equal(isRecoverableOAuthErrorCode('please_restart_the_process'), true);
assert.equal(isRecoverableOAuthErrorCode('state_mismatch'), true);
assert.equal(isRecoverableOAuthErrorCode('access_denied'), false);
assert.equal(stripOAuthErrorParams(params).get('ref'), 'ABC');
assert.equal(stripOAuthErrorParams(params).get('error'), null);

const missingState = new URLSearchParams('state=state_not_found');
assert.equal(oauthErrorCodeFromSearchParams(missingState), 'state_not_found');

const authSource = await read('server/auth.js');
assert.match(authSource, /onAPIError:\s*\{[\s\S]*errorURL:\s*oauthErrorURL/, 'auth must send OAuth errors to /login');
assert.match(authSource, /storeStateStrategy:\s*"database"/, 'auth must store OAuth state in the database');
assert.match(authSource, /skipStateCookieCheck:\s*true/, 'auth must tolerate missing OAuth state cookies on WebKit bounce');

const routerSource = await read('api/router.js');
assert.match(routerSource, /pathname === "\/api\/auth\/google-start"/, 'router must intercept google-start before Better Auth');
assert.match(routerSource, /handleGoogleOAuthStart/, 'router must call the Google start handler');

const devAuthSource = await read('scripts/dev-auth-server.mjs');
assert.match(devAuthSource, /\/api\/auth\/google-start/, 'local auth proxy must intercept google-start');

const startSource = await read('server/googleOAuthStart.js');
assert.match(startSource, /auth\.handler\(baRequest\)/, 'google-start must mint OAuth state through Better Auth');
assert.match(startSource, /copySetCookieHeaders/, 'google-start must copy Set-Cookie onto the document response');
assert.match(startSource, /buildGoogleContinueHtml/, 'google-start must return an HTML interstitial, not a 302 to Google');

const authContextSource = await read('src/contexts/AuthContext.jsx');
assert.match(authContextSource, /window\.location\.assign\(startURL\)/, 'Google sign-in must be a top-level navigation');
assert.match(authContextSource, /\/api\/auth\/google-start/, 'Google sign-in must start at google-start');
assert.doesNotMatch(authContextSource, /betterSignIn\.social/, 'Google sign-in must not use XHR social start');

const loginSource = await read('src/pages/Login.jsx');
assert.match(loginSource, /oauthErrorCodeFromSearchParams/, 'Login must read OAuth error query params');
assert.match(loginSource, /claimOAuthRecoveryAttempt/, 'Login must retry recoverable OAuth callbacks once');
assert.match(loginSource, /watermelonToast\(msg, \{ type: 'error' \}\)/, 'Login must toast OAuth callback errors');
assert.match(loginSource, /signInWithGoogle\(redirectTarget\)/, 'Login must keep campaign redirectTarget for Google');

const signUpSource = await read('src/pages/SignUp.jsx');
assert.match(signUpSource, /oauthErrorCodeFromSearchParams/, 'SignUp must read OAuth error query params');
assert.match(signUpSource, /claimOAuthRecoveryAttempt/, 'SignUp must retry recoverable OAuth callbacks once');
assert.match(signUpSource, /const \{ error: signInError \} = await signInWithGoogle\(\);/, 'SignUp must still call signInWithGoogle');

console.log('google-oauth-login-error-redirect-regression.test.mjs passed');
