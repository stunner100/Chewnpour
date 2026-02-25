import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const targets = [
  path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx'),
  path.join(root, 'src', 'pages', 'AssignmentHelper.jsx'),
  path.join(root, 'src', 'pages', 'Subscription.jsx'),
];

for (const target of targets) {
  const source = await fs.readFile(target, 'utf8');
  const shortName = path.basename(target);

  if (!/useAction|useMutation|useQuery|useConvexAuth/.test(source) && !/useConvexAuth/.test(source)) {
    throw new Error(`Expected ${shortName} to import useConvexAuth from convex/react.`);
  }

  if (!/const\s+\{\s*isAuthenticated:\s*isConvexAuthenticated\s*\}\s*=\s*useConvexAuth\(\)/.test(source)) {
    throw new Error(`Expected ${shortName} to derive isConvexAuthenticated from useConvexAuth().`);
  }

  if (!/api\.subscriptions\.getUploadQuotaStatus/.test(source)) {
    throw new Error(`Expected ${shortName} to query api.subscriptions.getUploadQuotaStatus.`);
  }

  if (!/userId\s*&&\s*isConvexAuthenticated\s*\?\s*\{\}\s*:\s*'skip'/.test(source)) {
    throw new Error(
      `Expected ${shortName} to gate getUploadQuotaStatus with userId && isConvexAuthenticated before querying.`,
    );
  }
}

console.log('upload-quota-auth-gating-regression.test.mjs passed');
