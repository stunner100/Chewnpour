import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const schemaSource = await read('convex/schema.ts');
for (const pattern of [
  'purchasedUploadCredits: v.optional(v.number())',
  'consumedUploadCredits: v.optional(v.number())',
  'lastPaymentReference: v.optional(v.string())',
  'lastPaymentAt: v.optional(v.number())',
  'paymentTransactions: defineTable({',
  '.index("by_reference", ["reference"])',
  '.index("by_userId", ["userId"])',
  '.index("by_userId_createdAt", ["userId", "createdAt"])',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected schema to include "${pattern}" for paystack quota support.`);
  }
}

const subscriptionsSource = await read('convex/subscriptions.ts');
for (const pattern of [
  'export const FREE_UPLOAD_LIMIT = 1;',
  'export const getUploadQuotaStatus = query({',
  'export const initializePaystackTopUpCheckout = action({',
  'export const verifyPaystackTopUpAfterRedirect = action({',
  'export const processPaystackWebhookEvent = mutation({',
  'const hasPremiumPaymentHistory = (subscription: any, purchasedCredits: number) =>',
  'const resolveConsumedUploadCredits = (params: {',
  'const isFirstPaidGrant = purchasedCredits <= 0;',
  'Math.min(FREE_UPLOAD_LIMIT, consumedCreditsBeforeTopUp)',
  'export const reconcileUploadConsumedCreditsInternal = internalMutation({',
  'UPLOAD_QUOTA_EXCEEDED',
  'consumeUploadCreditOrThrow',
]) {
  if (!subscriptionsSource.includes(pattern)) {
    throw new Error(`Expected subscriptions.ts to include "${pattern}".`);
  }
}
if (!subscriptionsSource.includes('canTopUp: true')) {
  throw new Error('Expected subscriptions.ts to allow top-up regardless of remaining uploads.');
}
if (subscriptionsSource.includes('TOPUP_NOT_REQUIRED')) {
  throw new Error('Regression detected: initializePaystackTopUpCheckout should not block top-ups before quota is exhausted.');
}

const uploadsSource = await read('convex/uploads.ts');
for (const pattern of [
  'consumeUploadCreditOrThrow',
  'getHistoricalStoredUploadCount',
  'UPLOAD_QUOTA_EXCEEDED',
  'ctx.storage.delete(args.storageId)',
]) {
  if (!uploadsSource.includes(pattern)) {
    throw new Error(`Expected uploads.ts to include "${pattern}" for quota enforcement.`);
  }
}

const assignmentsSource = await read('convex/assignments.ts');
for (const pattern of [
  'consumeUploadCreditOrThrow',
  'getHistoricalStoredUploadCount',
  'UPLOAD_QUOTA_EXCEEDED',
  'ctx.storage.delete(args.storageId)',
]) {
  if (!assignmentsSource.includes(pattern)) {
    throw new Error(`Expected assignments.ts to include "${pattern}" for quota enforcement.`);
  }
}

const subscriptionPageSource = await read('src/pages/Subscription.jsx');
if (subscriptionPageSource.includes('upgradeToPremium')) {
  throw new Error('Regression detected: Subscription page still uses upgradeToPremium directly.');
}
for (const pattern of [
  'initializePaystackTopUpCheckout',
  'api.subscriptions.getUploadQuotaStatus',
]) {
  if (!subscriptionPageSource.includes(pattern)) {
    throw new Error(`Expected Subscription page to include "${pattern}".`);
  }
}
for (const disallowedPattern of [
  'Top-up is available when your remaining uploads reach 0.',
  'Top-up becomes available when your remaining uploads reach 0.',
]) {
  if (subscriptionPageSource.includes(disallowedPattern)) {
    throw new Error(`Regression detected: found stale top-up gating copy "${disallowedPattern}".`);
  }
}

const appSource = await read('src/App.jsx');
if (!appSource.includes('/subscription/callback')) {
  throw new Error('Expected App routes to include /subscription/callback.');
}

console.log('paystack-upload-quota-regression.test.mjs passed');
