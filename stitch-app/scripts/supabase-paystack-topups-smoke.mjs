import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(thisDir, '..');

loadEnv({ path: path.join(root, '.env.local') });
loadEnv({ path: path.join(root, '.env') });

// Force manual provider for local smoke (no live Paystack charge).
process.env.PAYMENT_PROVIDER = 'manual';

const baseUrl = `http://127.0.0.1:${process.env.AUTH_DEV_PORT || 8787}`;
const stamp = Date.now();
const email = `topup-smoke-${stamp}@example.com`;
const password = `SmokePass!${stamp}`;
const name = 'TopUp Smoke';

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

const api = async (pathname, { method = 'GET', body } = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      Origin: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
      ...(cookieJar.size ? { Cookie: cookieHeader() } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
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

console.log(`[topup-smoke] using ${baseUrl} (PAYMENT_PROVIDER=manual)`);

{
  const health = await fetch(baseUrl).catch(() => null);
  assert(health, `Auth server is not reachable at ${baseUrl}. Run: npm run dev:auth`);
}

const signup = await api('/api/auth/sign-up/email', {
  method: 'POST',
  body: { email, password, name },
});
assert(signup.response.ok, `sign-up failed: ${signup.payload?.message || signup.response.status}`);

const billingBefore = await api('/api/billing');
assert(billingBefore.response.ok, `billing GET failed: ${billingBefore.payload?.error || billingBefore.response.status}`);
assert(
  billingBefore.payload?.billing?.remainingUploadCredits === 3,
  `Expected 3 starter credits, got ${billingBefore.payload?.billing?.remainingUploadCredits}`,
);
assert(
  Array.isArray(billingBefore.payload?.quota?.topUpOptions)
    && billingBefore.payload.quota.topUpOptions.some((plan) => plan.id === 'first-time-starter'),
  'Expected first-time starter in top-up options',
);

const checkout = await api('/api/billing/checkout', {
  method: 'POST',
  body: {
    topUpPlanId: 'first-time-starter',
    returnPath: '/dashboard',
  },
});
assert(checkout.response.ok, `checkout failed: ${checkout.payload?.error || checkout.response.status}`);
assert(checkout.payload?.provider === 'manual', `Expected manual provider, got ${checkout.payload?.provider}`);
assert(checkout.payload?.reference, 'Expected checkout reference');

const verify = await api('/api/billing/verify', {
  method: 'POST',
  body: {
    reference: checkout.payload.reference,
    returnPath: '/dashboard',
  },
});
assert(verify.response.ok, `verify failed: ${verify.payload?.error || verify.response.status}`);
assert(verify.payload?.success === true, `Expected verify success, got ${JSON.stringify(verify.payload)}`);
assert(
  verify.payload?.grantedCredits === 5,
  `Expected 5 granted credits, got ${verify.payload?.grantedCredits}`,
);

const billingAfter = await api('/api/billing');
assert(
  billingAfter.payload?.billing?.remainingUploadCredits === 8,
  `Expected 8 remaining after top-up (3+5), got ${billingAfter.payload?.billing?.remainingUploadCredits}`,
);
assert(
  !billingAfter.payload?.quota?.topUpOptions?.some((plan) => plan.id === 'first-time-starter'),
  'Expected first-time starter to disappear after purchase',
);

const verifyAgain = await api('/api/billing/verify', {
  method: 'POST',
  body: {
    reference: checkout.payload.reference,
    returnPath: '/dashboard',
  },
});
assert(verifyAgain.payload?.success === true, 'Expected duplicate verify to succeed idempotently');
assert(
  (await api('/api/billing')).payload?.billing?.remainingUploadCredits === 8,
  'Expected duplicate verify not to double-grant credits',
);

const { applySuccessfulPayment } = await import(
  pathToFileURL(path.join(root, 'server', 'payments.js')).href
);
const duplicateApply = await applySuccessfulPayment({
  reference: checkout.payload.reference,
  amountMinor: 1500,
  currency: 'GHS',
  provider: 'manual',
  source: 'smoke_duplicate',
});
assert(duplicateApply.duplicate === true, 'Expected applySuccessfulPayment duplicate=true');

console.log('[topup-smoke] passed', {
  email,
  remainingAfterSignup: 3,
  remainingAfterTopUp: 8,
});
