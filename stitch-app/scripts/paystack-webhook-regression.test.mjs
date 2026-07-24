import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const webhookPath = path.join(root, 'api', 'paystack-webhook.js');
const source = await fs.readFile(webhookPath, 'utf8');

for (const pattern of [
  'x-paystack-signature',
  'createHmac("sha512"',
  'secureCompare',
  'applySuccessfulPayment',
  'PAYSTACK_SECRET_KEY',
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected paystack webhook route to include "${pattern}".`);
  }
}

for (const stale of ['ConvexHttpClient', 'api.subscriptions.processPaystackWebhookEvent', 'PAYSTACK_WEBHOOK_FORWARD_SECRET']) {
  if (source.includes(stale)) {
    throw new Error(`Expected paystack webhook to drop Convex dependency: ${stale}`);
  }
}

console.log('paystack-webhook-regression.test.mjs passed');
