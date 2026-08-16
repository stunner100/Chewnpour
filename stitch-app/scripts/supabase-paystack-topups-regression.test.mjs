import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const app = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');
if (!app.includes('<Route path="/subscription" element={<Navigate to="/dashboard" replace />} />')) {
  throw new Error('Expected /subscription to redirect to the dashboard.');
}
if (!app.includes('<Route path="/subscription/callback" element={<Navigate to="/dashboard" replace />} />')) {
  throw new Error('Expected /subscription/callback to redirect to the dashboard.');
}

const billingHttp = await fs.readFile(path.join(root, 'server', 'billingHttp.js'), 'utf8');
if (!/BILLING_RETIRED/.test(billingHttp)) {
  throw new Error('Expected billing HTTP checkout to be retired.');
}

const settings = await fs.readFile(path.join(root, 'src', 'pages', 'AccountStudySettings.jsx'), 'utf8');
if (/Buy upload credits/.test(settings) || /initializeTopUpCheckout/.test(settings)) {
  throw new Error('Settings must not link to paid top-up after the free cutover.');
}

const upload = await fs.readFile(path.join(root, 'src', 'pages', 'UploadMaterials.jsx'), 'utf8');
if (/UPLOAD_CREDITS_EXHAUSTED/.test(upload) || /\/subscription\?from=/.test(upload)) {
  throw new Error('Upload UI must not redirect to a paywall.');
}

console.log('supabase-paystack-topups-regression.test.mjs passed');
