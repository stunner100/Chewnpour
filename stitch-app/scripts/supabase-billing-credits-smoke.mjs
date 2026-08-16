import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(thisDir, '..');

loadEnv({ path: path.join(root, '.env.local') });
loadEnv({ path: path.join(root, '.env') });

const baseUrl = `http://127.0.0.1:${process.env.AUTH_DEV_PORT || 8787}`;
const stamp = Date.now();
const email = `billing-smoke-${stamp}@example.com`;
const password = `SmokePass!${stamp}`;
const name = 'Billing Smoke';

const cookieJar = new Map();

const rememberCookies = (response) => {
  const raw = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  for (const entry of raw) {
    const [pair] = String(entry).split(';');
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
};

const cookieHeader = () =>
  Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

const api = async (pathname, { method = 'GET', body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      Origin: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
      ...(cookieJar.size ? { Cookie: cookieHeader() } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  rememberCookies(response);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

console.log(`[billing-smoke] using ${baseUrl}`);

{
  const health = await fetch(baseUrl).catch(() => null);
  assert(health, `Auth server is not reachable at ${baseUrl}. Run: npm run dev:auth`);
}

const signup = await api('/api/auth/sign-up/email', {
  method: 'POST',
  body: { email, password, name },
});
assert(signup.response.ok, `sign-up failed: ${signup.payload?.message || signup.response.status}`);

const billingAfterSignup = await api('/api/billing');
assert(billingAfterSignup.response.ok, `billing GET failed: ${billingAfterSignup.payload?.error || billingAfterSignup.response.status}`);

const { consumeUploadCredit, assertUploadCreditsAvailable, getBillingForUser } = await import(
  pathToFileURL(path.join(root, 'server', 'billing.js')).href
);

const userId = billingAfterSignup.payload.billing.userId;
assert(userId, 'Expected billing payload to include userId');

const before = await getBillingForUser(userId);
const afterSpend = await consumeUploadCredit({
  userId,
  uploadId: null,
});
assert(
  afterSpend.remainingUploadCredits === before.remainingUploadCredits,
  'Expected consumeUploadCredit to be a no-op after the free cutover.',
);

const stillAllowed = await assertUploadCreditsAvailable(userId);
assert(stillAllowed?.userId === userId, 'Expected assertUploadCreditsAvailable to allow uploads.');

const init = await api('/api/uploads/init', {
  method: 'POST',
  body: {
    fileName: 'free-upload.pdf',
    fileType: 'pdf',
    fileSize: 32,
    contentType: 'application/pdf',
  },
});
assert(init.response.status !== 402, `Upload init must not return 402, got ${init.response.status}`);

console.log('[billing-smoke] passed', {
  email,
  remaining: afterSpend.remainingUploadCredits,
});
