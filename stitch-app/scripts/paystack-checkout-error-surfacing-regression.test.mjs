import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const billingHttp = await fs.readFile(path.join(root, 'server', 'billingHttp.js'), 'utf8');
if (!/BILLING_RETIRED/.test(billingHttp) || !/410/.test(billingHttp)) {
  throw new Error('Expected checkout to return 410 instead of initializing Paystack.');
}

const subscriptionPageSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'Subscription.jsx'),
  'utf8',
);
if (/initializeTopUpCheckout|resolveConvexActionError/.test(subscriptionPageSource)) {
  throw new Error('Subscription.jsx must not run checkout after the free cutover.');
}

console.log('paystack-checkout-error-surfacing-regression.test.mjs passed');
