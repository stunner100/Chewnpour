import process from 'node:process';

const authBaseUrl = process.env.AUTH_BASE_URL || 'https://site.chewnpour.com';
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'https://www.chewnpour.com';
const callbackURL = process.env.GOOGLE_CALLBACK_URL || `${frontendOrigin}/dashboard`;

const response = await fetch(`${authBaseUrl}/api/auth/sign-in/social`, {
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

const text = await response.text();
if (!response.ok) {
  throw new Error(`Google sign-in callback probe failed (${response.status}): ${text.slice(0, 500)}`);
}

const payload = JSON.parse(text);
const googleUrl = typeof payload?.url === 'string' ? payload.url : '';
if (!googleUrl.startsWith('https://accounts.google.com/')) {
  throw new Error(`Expected Google OAuth URL, got: ${googleUrl || text.slice(0, 500)}`);
}

if (/INVALID_CALLBACKURL|Invalid callbackURL/i.test(text)) {
  throw new Error('Google sign-in still rejects the production callbackURL.');
}

console.log('production-google-callback-regression.test.mjs passed');
