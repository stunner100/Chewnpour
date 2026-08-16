import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [landingSource, billingHttp, subscriptionPageSource] = await Promise.all([
  read('src/pages/LandingPage.jsx'),
  read('server/billingHttp.js'),
  read('src/pages/Subscription.jsx'),
]);

for (const pattern of [
  'Free forever, no subscription',
  'Free Plan',
  'Get Started Free',
]) {
  if (!landingSource.includes(pattern)) {
    throw new Error(`Expected LandingPage.jsx to include "${pattern}".`);
  }
}

for (const pattern of [
  'normalizeTopUpOptions',
  'formatPlanPrice',
  'amountMajor: 20',
  'Basic Plan',
  'Pro Plan',
]) {
  if (landingSource.includes(pattern)) {
    throw new Error(`LandingPage.jsx should not include paid pricing leftover "${pattern}".`);
  }
}

if (!billingHttp.includes('BILLING_RETIRED')) {
  throw new Error('Expected billing checkout to be retired.');
}

if (!subscriptionPageSource.includes('Navigate to="/dashboard"')) {
  throw new Error('Expected Subscription.jsx to redirect to the dashboard.');
}

console.log('pricing-topup-plans-regression.test.mjs passed');
