import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const subscriptionsPath = path.join(root, 'convex', 'subscriptions.ts');
const dashboardAnalysisPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const assignmentHelperPath = path.join(root, 'src', 'pages', 'AssignmentHelper.jsx');

const [subscriptionsSource, dashboardAnalysisSource, assignmentHelperSource] = await Promise.all([
  fs.readFile(subscriptionsPath, 'utf8'),
  fs.readFile(dashboardAnalysisPath, 'utf8'),
  fs.readFile(assignmentHelperPath, 'utf8'),
]);

if (!/const shouldBypassUploadQuota = \(\) =>/.test(subscriptionsSource)) {
  throw new Error('Expected subscriptions.ts to define an environment-aware upload quota bypass helper.');
}

if (!/const UPLOAD_QUOTA_BYPASSED = shouldBypassUploadQuota\(\);/.test(subscriptionsSource)) {
  throw new Error('Expected subscriptions.ts to cache the upload quota bypass decision.');
}

if (!/quotaBypassed:\s*true/.test(subscriptionsSource)) {
  throw new Error('Expected staging quota snapshots to mark quotaBypassed: true.');
}

if (!/if \(UPLOAD_QUOTA_BYPASSED\) \{\s*return buildUploadQuotaSnapshot\(/s.test(subscriptionsSource)) {
  throw new Error('Expected quota consumption to short-circuit when staging quota bypass is active.');
}

if (!/const isUploadQuotaBypassed = Boolean\(uploadQuota\?\.quotaBypassed\);/.test(dashboardAnalysisSource)) {
  throw new Error('Expected DashboardAnalysis to read quotaBypassed from uploadQuota.');
}

if (!/if \(!isUploadQuotaBypassed && uploadQuota && Number\(uploadQuota\.remaining\) <= 0\)/.test(dashboardAnalysisSource)) {
  throw new Error('Expected DashboardAnalysis upload preflight to ignore exhausted quota when bypassed.');
}

if (!/Staging uploads unlocked/.test(dashboardAnalysisSource)) {
  throw new Error('Expected DashboardAnalysis to replace the Top up CTA with staging upload copy.');
}

if (!/subscription && subscription\.plan !== 'premium' && !isUploadQuotaBypassed/.test(dashboardAnalysisSource)) {
  throw new Error('Expected DashboardAnalysis upgrade banner to stay hidden when upload quota is bypassed.');
}

if (!/if \(!isUploadQuotaBypassed && uploadQuota && Number\(uploadQuota\.remaining\) <= 0\)/.test(assignmentHelperSource)) {
  throw new Error('Expected AssignmentHelper upload preflight to ignore exhausted quota when bypassed.');
}

console.log('staging-upload-quota-bypass-regression.test.mjs passed');
