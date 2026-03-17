import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const appSource = await read('src/App.jsx');
for (const pattern of ['path="/unsubscribe"', "import('./pages/Unsubscribe')"]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected App.jsx to include "${pattern}".`);
  }
}

const unsubscribeSource = await read('src/pages/Unsubscribe.jsx');
for (const pattern of ['unsubscribeByToken', 'winback_offers', 'Preferences updated']) {
  if (!unsubscribeSource.includes(pattern)) {
    throw new Error(`Expected Unsubscribe.jsx to include "${pattern}".`);
  }
}

const profileSource = await read('src/pages/Profile.jsx');
for (const pattern of ['winbackOffers', 'Win-back Offers']) {
  if (!profileSource.includes(pattern)) {
    throw new Error(`Expected Profile.jsx to include "${pattern}".`);
  }
}

const schemaSource = await read('convex/schema.ts');
for (const pattern of ['winbackOffers: v.boolean()', 'campaignCreditGrants', 'by_userId_campaignId']) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected schema.ts to include "${pattern}".`);
  }
}

const profilesSource = await read('convex/profiles.ts');
for (const pattern of ['winbackOffers: v.optional(v.boolean())', 'winback_offers', 'winbackOffers: false']) {
  if (!profilesSource.includes(pattern)) {
    throw new Error(`Expected profiles.ts to include "${pattern}".`);
  }
}

const winbackSource = await read('convex/winbackCampaigns.ts');
for (const pattern of [
  'previewChurnWinbackCampaign',
  'getChurnBreakdown',
  'getChurnBreakdownRowsInternal',
  'getNeverActivatedUsers',
  'runChurnWinbackCampaign',
  'ensureCampaignCreditGrantInternal',
  'campaignCreditGrants',
  'upload credits have already been added',
]) {
  if (!winbackSource.includes(pattern)) {
    throw new Error(`Expected winbackCampaigns.ts to include "${pattern}".`);
  }
}

console.log('churn-winback-campaign-regression.test.mjs passed');
