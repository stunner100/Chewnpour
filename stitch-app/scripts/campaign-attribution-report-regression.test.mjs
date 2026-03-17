import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  await fs.readFile(path.join(root, relativePath), 'utf8');

const schemaSource = await read('convex/schema.ts');
for (const pattern of [
  'campaignLandingEvents: defineTable({',
  '.index("by_userId_campaignId", ["userId", "campaignId"])',
  '.index("by_campaignId_firstLandedAt", ["campaignId", "firstLandedAt"])',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected schema.ts to include "${pattern}".`);
  }
}

const attributionSource = await read('convex/campaignAttribution.ts');
for (const pattern of [
  'export const recordCampaignLanding = mutation({',
  'query("campaignLandingEvents")',
  'withIndex("by_userId_campaignId"',
  'landingCount',
]) {
  if (!attributionSource.includes(pattern)) {
    throw new Error(`Expected campaignAttribution.ts to include "${pattern}".`);
  }
}

const appSource = await read('src/App.jsx');
for (const pattern of [
  'CampaignAttributionTracker',
  'api.campaignAttribution.recordCampaignLanding',
  "capturePostHogEvent('campaign_landing'",
  'stashPendingCampaignAttribution',
  'hasConvexUrl ? <CampaignAttributionTracker /> : null',
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected App.jsx to include "${pattern}".`);
  }
}

const loginSource = await read('src/pages/Login.jsx');
for (const pattern of [
  'readCampaignAttributionFromSearch',
  'stashPendingCampaignAttribution',
  'signInWithGoogle(redirectTarget)',
  'navigate(redirectTarget, { replace: true })',
]) {
  if (!loginSource.includes(pattern)) {
    throw new Error(`Expected Login.jsx to include "${pattern}".`);
  }
}

const adminSource = await read('convex/admin.ts');
for (const pattern of [
  'ctx.db.query("campaignLandingEvents").collect()',
  'ctx.db.query("campaignCreditGrants").collect()',
  'const campaignPerformanceReports =',
  'attributedLandingCount',
  'returnedCount',
  'uploadedCount',
  'activatedCount',
  'paidCount',
]) {
  if (!adminSource.includes(pattern)) {
    throw new Error(`Expected admin.ts to include "${pattern}".`);
  }
}

const dashboardSource = await read('src/pages/AdminDashboard.jsx');
for (const pattern of [
  'title="Campaign Performance"',
  'Attributed CTA landings',
  'campaignPerformanceReports',
  'Returned',
  'Activated',
  'Paid',
]) {
  if (!dashboardSource.includes(pattern)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${pattern}".`);
  }
}

console.log('campaign-attribution-report-regression.test.mjs passed');
