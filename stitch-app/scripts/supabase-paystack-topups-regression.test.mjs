import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveTopUpPlanById, listTopUpPlans } from '../server/topUpPlans.js';

const root = process.cwd();

const migration = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724130000_payments_topups.sql'),
  'utf8',
);
if (!/CREATE TABLE IF NOT EXISTS "payments"/.test(migration)) {
  throw new Error('Expected payments migration to create the payments table.');
}

const payments = await fs.readFile(path.join(root, 'server', 'payments.js'), 'utf8');
for (const symbol of [
  'initializeTopUpCheckout',
  'verifyTopUpAfterRedirect',
  'applySuccessfulPayment',
  'getBillingSnapshotForUser',
]) {
  if (!payments.includes(`export const ${symbol}`)) {
    throw new Error(`Expected server/payments.js to export ${symbol}.`);
  }
}

const billing = await fs.readFile(path.join(root, 'server', 'billing.js'), 'utf8');
if (!/grantPurchasedCredits/.test(billing) || !/hasSuccessfulPurchase/.test(billing)) {
  throw new Error('Expected billing.js to grant purchased credits and track purchases.');
}

const billingHttp = await fs.readFile(path.join(root, 'server', 'billingHttp.js'), 'utf8');
if (!/checkout/.test(billingHttp) || !/verify/.test(billingHttp)) {
  throw new Error('Expected billing HTTP handler to expose checkout and verify routes.');
}

const subscription = await fs.readFile(path.join(root, 'src', 'pages', 'Subscription.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(subscription)) {
  throw new Error('Expected Subscription.jsx to stop depending on Convex.');
}
if (!/\/api\/billing\/checkout/.test(subscription)) {
  throw new Error('Expected Subscription.jsx to call /api/billing/checkout.');
}

const callback = await fs.readFile(path.join(root, 'src', 'pages', 'SubscriptionCallback.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(callback)) {
  throw new Error('Expected SubscriptionCallback.jsx to stop depending on Convex.');
}
if (!/\/api\/billing\/verify/.test(callback)) {
  throw new Error('Expected SubscriptionCallback.jsx to call /api/billing/verify.');
}

const app = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');
if (!/path=\"\/subscription\"\s+element=\{withSuspense\(<ProtectedRoute>/.test(app)) {
  throw new Error('Expected /subscription route to render the Subscription page.');
}

const settings = await fs.readFile(path.join(root, 'src', 'pages', 'AccountStudySettings.jsx'), 'utf8');
if (!/Buy upload credits/.test(settings) || !/\/subscription/.test(settings)) {
  throw new Error('Expected settings to link to the subscription top-up page.');
}

const plans = listTopUpPlans({ includeFirstTime: true });
if (!plans.some((plan) => plan.id === 'first-time-starter')) {
  throw new Error('Expected first-time starter plan in catalog.');
}
const starter = resolveTopUpPlanById('starter');
if (!starter || starter.credits !== 5 || starter.amountMinor !== 2000) {
  throw new Error('Expected starter plan to remain GHS 20 / 5 credits.');
}

console.log('supabase-paystack-topups-regression.test.mjs passed');
