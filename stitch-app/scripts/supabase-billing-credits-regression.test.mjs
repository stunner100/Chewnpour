import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const migration = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724125000_billing_credits.sql'),
  'utf8',
);
if (!/CREATE TABLE IF NOT EXISTS "billing_accounts"/.test(migration)) {
  throw new Error('Expected billing migration to create billing_accounts.');
}
if (!/CREATE TABLE IF NOT EXISTS "credit_ledger"/.test(migration)) {
  throw new Error('Expected billing migration to create credit_ledger.');
}

const billing = await fs.readFile(path.join(root, 'server', 'billing.js'), 'utf8');
for (const symbol of [
  'ensureBillingAccount',
  'assertUploadCreditsAvailable',
  'consumeUploadCredit',
  'chargeUploadIfNeeded',
  'STARTER_UPLOAD_CREDITS',
  'UPLOAD_CREDIT_COST',
]) {
  if (!billing.includes(`export const ${symbol}`)) {
    throw new Error(`Expected server/billing.js to export ${symbol}.`);
  }
}

const billingHttp = await fs.readFile(path.join(root, 'server', 'billingHttp.js'), 'utf8');
if (!/handleBillingRequest/.test(billingHttp) || !/getBillingForUser/.test(billingHttp)) {
  throw new Error('Expected billing HTTP handler to serve getBillingForUser.');
}

const apiRoute = await fs.readFile(path.join(root, 'api', 'billing.js'), 'utf8');
if (!/handleBillingRequest/.test(apiRoute)) {
  throw new Error('Expected api/billing.js to export the billing HTTP handler.');
}

const authSource = await fs.readFile(path.join(root, 'server', 'auth.js'), 'utf8');
if (!/ensureBillingAccount/.test(authSource)) {
  throw new Error('Expected signup hook to ensure a billing account.');
}

const uploads = await fs.readFile(path.join(root, 'server', 'uploads.js'), 'utf8');
if (!/assertUploadCreditsAvailable/.test(uploads) || !/chargeUploadIfNeeded/.test(uploads)) {
  throw new Error('Expected finalizeUploadForUser to assert and charge upload credits.');
}

const uploadHttp = await fs.readFile(path.join(root, 'server', 'uploadHttp.js'), 'utf8');
if (!/assertUploadCreditsAvailable/.test(uploadHttp)) {
  throw new Error('Expected upload init to assert available credits.');
}
if (!/code: error\?\.code/.test(uploadHttp) || !/billing: error\?\.billing/.test(uploadHttp)) {
  throw new Error('Expected upload HTTP errors to surface billing code/payload.');
}

const settings = await fs.readFile(path.join(root, 'src', 'pages', 'AccountStudySettings.jsx'), 'utf8');
if (!/\/api\/billing/.test(settings) || !/remainingUploadCredits/.test(settings)) {
  throw new Error('Expected AccountStudySettings to show live billing balance.');
}
if (/Billing and upload credits return after the Supabase cutover/i.test(settings)) {
  throw new Error('Expected AccountStudySettings to drop the billing stub copy.');
}

const viteConfig = await fs.readFile(path.join(root, 'vite.config.js'), 'utf8');
if (!/['"]\/api\/billing['"]/.test(viteConfig)) {
  throw new Error('Expected Vite to proxy /api/billing to the local API server.');
}

const envExample = await fs.readFile(path.join(root, '.env.example'), 'utf8');
if (!/STARTER_UPLOAD_CREDITS=/.test(envExample) || !/UPLOAD_CREDIT_COST=/.test(envExample)) {
  throw new Error('Expected .env.example to document upload credit settings.');
}

console.log('supabase-billing-credits-regression.test.mjs passed');
