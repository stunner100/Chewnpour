import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  schemaSource,
  subscriptionsSource,
  cronsSource,
  adminSource,
  adminDashboardSource,
] = await Promise.all([
  read('convex/schema.ts'),
  read('convex/subscriptions.ts'),
  read('convex/crons.ts'),
  read('convex/admin.ts'),
  read('src/pages/AdminDashboard.jsx'),
]);

for (const pattern of [
  'lastVerifiedAt: v.optional(v.number())',
  'verificationAttempts: v.optional(v.number())',
  'verificationStatus: v.optional(v.string())',
  'verificationMessage: v.optional(v.string())',
  'alertedAt: v.optional(v.number())',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected schema.ts to include "${pattern}" on paymentTransactions.`);
  }
}

for (const pattern of [
  'PAYMENT_RECONCILE_DELAY_MS = 10 * 60 * 1000',
  'PAYMENT_RECONCILE_RETRY_INTERVAL_MS = 60 * 60 * 1000',
  'PAYMENT_VERIFY_ERROR_ALERT_ATTEMPTS = 3',
  'const sendBillingAlertEmail = async',
  'const verifyPaystackTransactionByReference = async',
  'export const getBillingAlertRecipientsInternal = internalQuery({',
  'export const listStalePaymentTransactionsInternal = internalQuery({',
  'export const updatePaymentVerificationStateInternal = internalMutation({',
  'ctx.scheduler.runAfter(PAYMENT_RECONCILE_DELAY_MS, internal.subscriptions.reconcilePaymentReferenceInternal',
  'export const reconcilePaymentReferenceInternal = internalAction({',
  'result: "verify_error"',
  'result: applyResult.applied ? "applied" : "duplicate"',
  'source: "reconcile_verify"',
  'Recovered via scheduled reconciliation.',
  'export const reconcileStalePaystackPaymentsInternal = internalAction({',
]) {
  if (!subscriptionsSource.includes(pattern)) {
    throw new Error(`Expected subscriptions.ts to include "${pattern}".`);
  }
}

if (!cronsSource.includes('"stale payment reconciliation"')) {
  throw new Error('Expected crons.ts to register stale payment reconciliation.');
}
if (!cronsSource.includes('internal.subscriptions.reconcileStalePaystackPaymentsInternal')) {
  throw new Error('Expected crons.ts to call the stale payment reconciliation internal action.');
}

for (const pattern of [
  'export const reconcilePaymentReference = action({',
  'trigger: "admin_manual"',
  'sendAlert: false',
  'const billingRecovery = {',
  'unresolvedPayments',
  'recoveredPaymentsTotal',
  'verificationAttempts',
]) {
  if (!adminSource.includes(pattern)) {
    throw new Error(`Expected admin.ts to include "${pattern}".`);
  }
}

for (const pattern of [
  'Billing Recovery',
  'Unresolved Payments',
  'Reconcile now',
  'const reconcilePaymentReference = useAction(api.admin.reconcilePaymentReference);',
  'const [billingActionError, setBillingActionError] = React.useState(\'\');',
  'const [billingActionMessage, setBillingActionMessage] = React.useState(\'\');',
  'const [reconcilingReferences, setReconcilingReferences] = React.useState({});',
  'const handleReconcilePayment = async (reference) => {',
  'formatTokenLabel(result?.result)',
  '<RevenuePanel',
  'handleReconcilePayment={handleReconcilePayment}',
  'billingActionError={billingActionError}',
  'billingActionMessage={billingActionMessage}',
  'reconcilingReferences={reconcilingReferences}',
]) {
  if (!adminDashboardSource.includes(pattern)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${pattern}".`);
  }
}

console.log('payment-reconciliation-alerting-regression.test.mjs passed');
