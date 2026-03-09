import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const read = async (relativePath) => {
  const targetPath = path.join(root, relativePath);
  return await fs.readFile(targetPath, 'utf8');
};

const [subscriptionsSource, subscriptionPageSource, landingSource, dashboardSource, assignmentSource] =
  await Promise.all([
    read('convex/subscriptions.ts'),
    read('src/pages/Subscription.jsx'),
    read('src/pages/LandingPage.jsx'),
    read('src/pages/DashboardAnalysis.jsx'),
    read('src/pages/AssignmentHelper.jsx'),
  ]);

for (const pattern of [
  'export const FREE_UPLOAD_LIMIT = 1;',
  'id: "starter"',
  'amountMajor: 20',
  'amountMinor: 2000',
  'credits: 5',
  'id: "max"',
  'amountMajor: 40',
  'amountMinor: 4000',
  'credits: 12',
]) {
  if (!subscriptionsSource.includes(pattern)) {
    throw new Error(`Expected subscriptions.ts to include "${pattern}" for pricing cutover.`);
  }
}

for (const pattern of [
  'topUpPlanId: v.string()',
  'args: {}',
  'resolveTopUpPlanById(args.topUpPlanId)',
  'const TOPUP_CHECKOUT_CURRENCIES = [TOPUP_CURRENCY];',
  'normalizedCurrency !== TOPUP_CURRENCY',
  'getPublicTopUpPricing = query',
  'topUpPlanId: selectedPlan.id',
  'topUpCredits: plan.credits',
  'expectedAmountMinor',
  'expectedCurrency',
]) {
  if (!subscriptionsSource.includes(pattern)) {
    throw new Error(`Expected subscriptions.ts to include "${pattern}" for plan-aware checkout/verify.`);
  }
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
if (subscriptionPageSource.includes('preferredCurrency')) {
  throw new Error('Currency cutover regression: Subscription.jsx should not reference preferredCurrency.');
}

for (const pattern of [
  'getPublicTopUpPricing',
  'formatPlanPrice',
  '1 document upload',
  'starterPlan.credits',
  'maxPlan.credits',
]) {
  if (!landingSource.includes(pattern)) {
    throw new Error(`Expected LandingPage.jsx to include "${pattern}" for public pricing display.`);
  }
}
if (landingSource.includes('preferredCurrency') || landingSource.includes('resolvePreferredPricingCurrency')) {
  throw new Error('Currency cutover regression: LandingPage.jsx should be GHS-only.');
}

for (const source of [dashboardSource, assignmentSource]) {
  if (!source.includes('buildUploadLimitMessageFromOptions')) {
    throw new Error('Expected paywall messaging to use localized top-up options.');
  }
  if (source.includes('preferredCurrency') || source.includes('resolvePreferredPricingCurrency')) {
    throw new Error('Currency cutover regression: paywall pages should not resolve preferred currency.');
  }
}

console.log('pricing-topup-plans-regression.test.mjs passed');
