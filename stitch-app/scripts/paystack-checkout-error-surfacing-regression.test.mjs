import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const subscriptionsSource = await fs.readFile(path.join(root, 'convex', 'subscriptions.ts'), 'utf8');

if (!/const\s+buildPaystackFailureMessage\s*=\s*\(statusCode:\s*number,\s*payload:\s*any\)\s*=>/.test(subscriptionsSource)) {
  throw new Error('Expected subscriptions.ts to normalize Paystack failure messages.');
}

if (!/\.\.\.\(providerCode\s*\?\s*\{\s*providerCode\s*\}\s*:\s*\{\}\)/.test(subscriptionsSource)) {
  throw new Error('Expected subscriptions.ts to include Paystack providerCode in request failures.');
}

if (!/catch\s*\(error\)\s*\{\s*if\s*\(error\s+instanceof\s+ConvexError\)\s*\{\s*throw error;\s*\}/s.test(subscriptionsSource)) {
  throw new Error('Expected initializePaystackTopUpCheckout to rethrow existing ConvexError values.');
}

const subscriptionPageSource = await fs.readFile(path.join(root, 'src', 'pages', 'Subscription.jsx'), 'utf8');

if (!/const\s+resolveConvexActionError\s*=\s*\(error,\s*fallbackMessage\)\s*=>/.test(subscriptionPageSource)) {
  throw new Error('Expected Subscription.jsx to unwrap structured Convex action errors.');
}

if (!/setError\(resolveConvexActionError\(checkoutError,\s*'Could not initialize checkout\.'\)\);/.test(subscriptionPageSource)) {
  throw new Error('Expected Subscription.jsx checkout failures to use resolveConvexActionError.');
}

console.log('paystack-checkout-error-surfacing-regression.test.mjs passed');
