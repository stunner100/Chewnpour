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

const uploads = await fs.readFile(path.join(root, 'server', 'uploads.js'), 'utf8');
if (/assertUploadCreditsAvailable/.test(uploads) || /chargeUploadIfNeeded/.test(uploads)) {
  throw new Error('Uploads must not gate or charge credits after the free cutover.');
}

const uploadHttp = await fs.readFile(path.join(root, 'server', 'uploadHttp.js'), 'utf8');
if (/assertUploadCreditsAvailable/.test(uploadHttp)) {
  throw new Error('Upload init must not assert credits after the free cutover.');
}

const billing = await fs.readFile(path.join(root, 'server', 'billing.js'), 'utf8');
if (!billing.includes('export const consumeUploadCredit = async ({ userId, uploadId: _uploadId }) =>')) {
  throw new Error('Expected consumeUploadCredit to be a no-op.');
}
if (!billing.includes('export const chargeUploadIfNeeded = async ({ userId, uploadId: _uploadId }) =>')) {
  throw new Error('Expected chargeUploadIfNeeded to be a no-op.');
}

const billingHttp = await fs.readFile(path.join(root, 'server', 'billingHttp.js'), 'utf8');
if (!/BILLING_RETIRED/.test(billingHttp) || !/410/.test(billingHttp)) {
  throw new Error('Expected billing checkout/verify to return 410 after the free cutover.');
}

const settings = await fs.readFile(path.join(root, 'src', 'pages', 'AccountStudySettings.jsx'), 'utf8');
if (/Buy upload credits/.test(settings) || /\/api\/billing/.test(settings)) {
  throw new Error('Settings must not sell credits or load billing after the free cutover.');
}
if (!/ChewnPour is free/.test(settings)) {
  throw new Error('Expected settings to say ChewnPour is free.');
}

console.log('supabase-billing-credits-regression.test.mjs passed');
