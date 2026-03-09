import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const subscriptionPath = path.join(root, 'src', 'pages', 'Subscription.jsx');
const dashboardPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const assignmentPath = path.join(root, 'src', 'pages', 'AssignmentHelper.jsx');

const [subscriptionSource, dashboardSource, assignmentSource] = await Promise.all([
  fs.readFile(subscriptionPath, 'utf8'),
  fs.readFile(dashboardPath, 'utf8'),
  fs.readFile(assignmentPath, 'utf8'),
]);

if (/freeLimit:\s*2\b/.test(subscriptionSource)) {
  throw new Error('Expected Subscription fallback freeLimit to stay aligned with backend free limit (1).');
}

if (!/freeLimit:\s*1\b/.test(subscriptionSource)) {
  throw new Error('Expected Subscription fallback freeLimit to be 1.');
}

if (/upload\s+2\s+files/i.test(subscriptionSource)) {
  throw new Error('Expected Subscription copy to avoid stale "2 uploads" messaging.');
}

if (!/Free users get \{freeLimit\} upload\{freeLimit === 1 \? '' : 's'\}/.test(subscriptionSource)) {
  throw new Error('Expected Subscription hero copy to use dynamic freeLimit text.');
}

if (!/reason === 'upload_limit'/.test(subscriptionSource)) {
  throw new Error('Expected Subscription to handle upload_limit as a dedicated reason branch.');
}

if (!/setError\(remaining <= 0 \? \(stateMessage \|\| uploadLimitMessage\) : ''\);/.test(subscriptionSource)) {
  throw new Error('Expected Subscription to suppress upload_limit paywall messaging when remaining uploads are available.');
}

if (!/setError\(remaining <= 0 \? stateMessage : ''\);/.test(subscriptionSource)) {
  throw new Error('Expected Subscription to avoid stale paywall state messages once quota is restored.');
}

for (const [name, source] of [
  ['DashboardAnalysis.jsx', dashboardSource],
  ['AssignmentHelper.jsx', assignmentSource],
]) {
  if (!/state:\s*\{\s*paywallMessage:/.test(source)) {
    throw new Error(`Expected ${name} to pass a paywall message state when redirecting to /subscription.`);
  }

  if (!/buildUploadLimitMessageFromOptions/.test(source)) {
    throw new Error(`Expected ${name} to build paywall messaging from localized top-up options.`);
  }
}

console.log('upload-quota-messaging-regression.test.mjs passed');
