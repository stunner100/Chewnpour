import process from 'node:process';

const authBaseUrl = (process.env.AUTH_BASE_URL || 'https://www.chewnpour.com').replace(/\/$/, '');
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'https://www.chewnpour.com';
const callbackURL = process.env.GOOGLE_CALLBACK_URL || `${frontendOrigin}/dashboard`;

const socialResponse = await fetch(`${authBaseUrl}/api/auth/sign-in/social`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: frontendOrigin,
  },
  body: JSON.stringify({
    provider: 'google',
    callbackURL,
  }),
});

const socialText = await socialResponse.text();
if (!socialResponse.ok) {
  throw new Error(`Google sign-in callback probe failed (${socialResponse.status}): ${socialText.slice(0, 500)}`);
}

const payload = JSON.parse(socialText);
const googleUrl = typeof payload?.url === 'string' ? payload.url : '';
if (!googleUrl.startsWith('https://accounts.google.com/')) {
  throw new Error(`Expected Google OAuth URL, got: ${googleUrl || socialText.slice(0, 500)}`);
}

if (/INVALID_CALLBACKURL|Invalid callbackURL/i.test(socialText)) {
  throw new Error('Google sign-in still rejects the production callbackURL.');
}

const startResponse = await fetch(
  `${authBaseUrl}/api/auth/google-start?callbackURL=${encodeURIComponent('/dashboard')}`,
  { redirect: 'manual' },
);
const startLocation = startResponse.headers.get('location') || '';
const startCookies = startResponse.headers.getSetCookie?.() || [];
const startText = startResponse.status === 200 ? await startResponse.text() : '';

const startedOAuth =
  (startResponse.status === 200 && startText.includes('accounts.google.com'))
  || startLocation.startsWith('https://accounts.google.com/');
if (!startedOAuth) {
  throw new Error(
    `Expected google-start to continue to Google, got ${startResponse.status} ${startLocation || startText.slice(0, 200)}`,
  );
}
if (startCookies.length === 0 && !String(startResponse.headers.get('set-cookie') || '')) {
  throw new Error('Expected google-start to Set-Cookie the OAuth state on the document response.');
}

const callbackResponse = await fetch(
  `${authBaseUrl}/api/auth/callback/google?code=test&state=test`,
  { redirect: 'follow' },
);
const finalUrl = callbackResponse.url || '';
if (!/\/login\?error=please_restart_the_process/.test(finalUrl)) {
  throw new Error(`Expected failed Google callback to land on /login?error=please_restart_the_process, got: ${finalUrl}`);
}

console.log('production-google-callback-regression.test.mjs passed');
