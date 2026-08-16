import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const appSource = await read('src/App.jsx');
if (!appSource.includes('/subscription/callback')) {
  throw new Error('Expected App routes to include /subscription/callback.');
}
if (!appSource.includes('<Route path="/subscription" element={<Navigate to="/dashboard" replace />} />')) {
  throw new Error('Expected /subscription to redirect to the dashboard.');
}

const subscriptionPageSource = await read('src/pages/Subscription.jsx');
if (subscriptionPageSource.includes('upgradeToPremium') || subscriptionPageSource.includes('initializePaystackTopUpCheckout')) {
  throw new Error('Regression detected: Subscription page still sells a paid plan.');
}
if (!subscriptionPageSource.includes('Navigate to="/dashboard"')) {
  throw new Error('Expected Subscription page to redirect to the dashboard.');
}

const uploads = await read('server/uploads.js');
if (/assertUploadCreditsAvailable/.test(uploads) || /chargeUploadIfNeeded/.test(uploads)) {
  throw new Error('Uploads must not enforce a paid quota.');
}

console.log('paystack-upload-quota-regression.test.mjs passed');
