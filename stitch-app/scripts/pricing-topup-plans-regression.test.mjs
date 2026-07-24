import fs from 'node:fs/promises';
import path from 'node:path';
import {
  listTopUpPlans,
  resolveTopUpPlanById,
  TOPUP_CURRENCY,
} from '../server/topUpPlans.js';

const root = process.cwd();

const read = async (relativePath) => {
  const targetPath = path.join(root, relativePath);
  return await fs.readFile(targetPath, 'utf8');
};

const [plansSource, subscriptionPageSource, landingSource, paymentsSource] =
  await Promise.all([
    read('server/topUpPlans.js'),
    read('src/pages/Subscription.jsx'),
    read('src/pages/LandingPage.jsx'),
    read('server/payments.js'),
  ]);

for (const pattern of [
  'export const TOPUP_CURRENCY = "GHS";',
  'id: "starter"',
  'amountMajor: 20',
  'amountMinor: 2000',
  'credits: 5',
  'id: "max"',
  'amountMajor: 40',
  'amountMinor: 4000',
  'credits: 12',
  'id: "first-time-starter"',
]) {
  if (!plansSource.includes(pattern)) {
    throw new Error(`Expected topUpPlans.js to include "${pattern}" for pricing cutover.`);
  }
}

for (const pattern of [
  'resolveTopUpPlanById',
  'listTopUpPlans',
  'TOPUP_CURRENCY',
  'initializeTopUpCheckout',
  'verifyTopUpAfterRedirect',
]) {
  if (!paymentsSource.includes(pattern)) {
    throw new Error(`Expected payments.js to include "${pattern}" for plan-aware checkout/verify.`);
  }
}

const starter = resolveTopUpPlanById('starter');
if (!starter || starter.currency !== TOPUP_CURRENCY || starter.amountMinor !== 2000 || starter.credits !== 5) {
  throw new Error('Expected starter plan to remain GHS 20 / 5 credits.');
}

const withFirstTime = listTopUpPlans({ includeFirstTime: true });
if (!withFirstTime.some((plan) => plan.id === 'first-time-starter')) {
  throw new Error('Expected first-time starter to appear when includeFirstTime is true.');
}

for (const pattern of [
  'buildUploadLimitMessageFromOptions',
  'normalizeTopUpOptions',
  'formatPlanPrice',
  'topUpPlanId: selectedTopUpPlan.id',
  '+{plan.credits} uploads',
]) {
  if (!subscriptionPageSource.includes(pattern)) {
    throw new Error(`Expected Subscription.jsx to include "${pattern}".`);
  }
}
if (subscriptionPageSource.includes('preferredCurrency') || subscriptionPageSource.includes("from 'convex/react'")) {
  throw new Error('Currency cutover regression: Subscription.jsx should be Convex-free and GHS-only.');
}

for (const pattern of [
  'normalizeTopUpOptions',
  'formatPlanPrice',
  'amountMajor: 20',
  'starterPlan.credits',
  'maxPlan.amountMajor',
]) {
  if (!landingSource.includes(pattern)) {
    throw new Error(`Expected LandingPage.jsx to include "${pattern}" for public pricing display.`);
  }
}
if (landingSource.includes('getPublicTopUpPricing') || landingSource.includes("from 'convex/react'")) {
  throw new Error('Expected LandingPage.jsx to stop depending on Convex public pricing.');
}
if (landingSource.includes('preferredCurrency') || landingSource.includes('resolvePreferredPricingCurrency')) {
  throw new Error('Currency cutover regression: LandingPage.jsx should be GHS-only.');
}

console.log('pricing-topup-plans-regression.test.mjs passed');
