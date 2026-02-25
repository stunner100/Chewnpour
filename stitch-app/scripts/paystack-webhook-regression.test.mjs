import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const webhookPath = path.join(root, 'api', 'paystack-webhook.js');
const source = await fs.readFile(webhookPath, 'utf8');

for (const pattern of [
  'x-paystack-signature',
  "createHmac('sha512'",
  'PAYSTACK_WEBHOOK_FORWARD_SECRET',
  'ConvexHttpClient',
  'api.subscriptions.processPaystackWebhookEvent',
  'secureCompare',
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected paystack webhook route to include "${pattern}".`);
  }
}

console.log('paystack-webhook-regression.test.mjs passed');
