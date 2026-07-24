import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  await fs.readFile(path.join(root, relativePath), 'utf8');

const appSource = await read('src/App.jsx');
for (const pattern of [
  'CampaignAttributionTracker',
  "capturePostHogEvent('campaign_landing'",
  'stashPendingCampaignAttribution',
  '<CampaignAttributionTracker />',
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected App.jsx to include "${pattern}".`);
  }
}
if (/useMutation\(api\.campaignAttribution\.recordCampaignLanding\)/.test(appSource)) {
  throw new Error('Expected App.jsx campaign tracker to stop depending on Convex mutations.');
}
if (/from ['"]convex\/react['"]/.test(appSource)) {
  throw new Error('Expected App.jsx to stop importing convex/react after Supabase auth cutover.');
}

const loginSource = await read('src/pages/Login.jsx');
for (const pattern of [
  'readCampaignAttributionFromSearch',
  'stashPendingCampaignAttribution',
  'signInWithGoogle(redirectTarget)',
  'navigate(redirectTarget, {',
]) {
  if (!loginSource.includes(pattern)) {
    throw new Error(`Expected Login.jsx to include "${pattern}".`);
  }
}

console.log('campaign-attribution-report-regression.test.mjs passed');
