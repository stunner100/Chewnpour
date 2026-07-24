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
assert(
  billingAfterSignup.payload?.billing?.remainingUploadCredits === 3,
  `Expected 3 starter credits, got ${billingAfterSignup.payload?.billing?.remainingUploadCredits}`,
);

const { consumeUploadCredit, assertUploadCreditsAvailable, getBillingForUser } = await import(
  pathToFileURL(path.join(root, 'server', 'billing.js')).href
);

const userId = billingAfterSignup.payload.billing.userId;
assert(userId, 'Expected billing payload to include userId');

const afterSpend = await consumeUploadCredit({
  userId,
  uploadId: null,
});
assert(
  afterSpend.remainingUploadCredits === 2,
  `Expected 2 credits after spend, got ${afterSpend.remainingUploadCredits}`,
);

const billingAfterSpend = await api('/api/billing');
assert(
  billingAfterSpend.payload?.billing?.remainingUploadCredits === 2,
  `Expected billing API to report 2 remaining, got ${billingAfterSpend.payload?.billing?.remainingUploadCredits}`,
);

await consumeUploadCredit({ userId, uploadId: null });
await consumeUploadCredit({ userId, uploadId: null });

const exhausted = await getBillingForUser(userId);
assert(
  exhausted.remainingUploadCredits === 0,
  `Expected 0 credits after exhausting starter pack, got ${exhausted.remainingUploadCredits}`,
);

let blocked = null;
try {
  await assertUploadCreditsAvailable(userId);
} catch (error) {
  blocked = error;
}
assert(blocked?.status === 402, 'Expected assertUploadCreditsAvailable to throw 402 when exhausted');
assert(blocked?.code === 'UPLOAD_CREDITS_EXHAUSTED', 'Expected UPLOAD_CREDITS_EXHAUSTED code');

const initBlocked = await api('/api/uploads/init', {
  method: 'POST',
  body: {
    fileName: 'credits-exhausted.txt',
    fileType: 'txt',
    fileSize: 32,
    contentType: 'text/plain',
  },
});
assert(initBlocked.response.status === 402, `Expected upload init 402, got ${initBlocked.response.status}`);
assert(
  initBlocked.payload?.code === 'UPLOAD_CREDITS_EXHAUSTED',
  `Expected exhausted code on init, got ${initBlocked.payload?.code}`,
);

console.log('[billing-smoke] passed', {
  email,
  remainingAfterSignup: 3,
  remainingAfterOneSpend: 2,
  remainingAfterExhaust: 0,
});
