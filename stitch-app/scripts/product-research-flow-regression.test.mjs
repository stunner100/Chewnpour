import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const appSource = await read('src/App.jsx');
if (!appSource.includes("path=\"/research\"")) {
  throw new Error('Expected App.jsx to register the public /research route.');
}

const productResearchPage = await read('src/pages/ProductResearch.jsx');
for (const pattern of [
  'submitResponseByToken',
  'additionalNotes',
  "source: 'email_research_form'",
  'How are you mainly using the app?',
  'What would you most like us to improve next?',
]) {
  if (!productResearchPage.includes(pattern)) {
    throw new Error(`Expected ProductResearch.jsx to include "${pattern}".`);
  }
}

const profilePage = await read('src/pages/Profile.jsx');
for (const pattern of ['productResearch: true']) {
  if (!profilePage.includes(pattern)) {
    throw new Error(`Expected Profile.jsx to include "${pattern}".`);
  }
}
for (const forbiddenPattern of ['Product Research', "handleEmailPrefToggle('productResearch')"]) {
  if (profilePage.includes(forbiddenPattern)) {
    throw new Error(`Expected Profile.jsx to hide "${forbiddenPattern}" from the profile UI.`);
  }
}

const adminPage = await read('src/pages/AdminDashboard.jsx');
for (const pattern of [
  'recentProductResearchResponses',
  'Product Research Responses',
  'additionalNotes',
]) {
  if (!adminPage.includes(pattern)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${pattern}".`);
  }
}

const schemaSource = await read('convex/schema.ts');
for (const pattern of ['productResearch: v.boolean()', 'productResearchToken', 'productResearchResponses']) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected schema.ts to include "${pattern}".`);
  }
}

const profilesSource = await read('convex/profiles.ts');
for (const pattern of ['productResearch: v.optional(v.boolean())', 'productResearch: args.productResearch', 'product_research']) {
  if (!profilesSource.includes(pattern)) {
    throw new Error(`Expected profiles.ts to include "${pattern}".`);
  }
}

const productResearchSource = await read('convex/productResearch.ts');
for (const pattern of ['submitResponseByToken', 'additionalNotes', 'wantedFeatures', 'productResearchToken']) {
  if (!productResearchSource.includes(pattern)) {
    throw new Error(`Expected productResearch.ts to include "${pattern}".`);
  }
}

const outreachSource = await read('convex/productResearchEmails.ts');
for (const pattern of ['sendOutreachEmails', '/research?token=', 'product_research']) {
  if (!outreachSource.includes(pattern)) {
    throw new Error(`Expected productResearchEmails.ts to include "${pattern}".`);
  }
}

const cronsSource = await read('convex/crons.ts');
if (!cronsSource.includes('product research outreach')) {
  throw new Error('Expected crons.ts to schedule product research outreach.');
}

const adminSource = await read('convex/admin.ts');
for (const pattern of ['recentProductResearchResponses', 'productResearchResponsesTotal', 'productResearchAnalytics']) {
  if (!adminSource.includes(pattern)) {
    throw new Error(`Expected admin.ts to include "${pattern}".`);
  }
}

console.log('product-research-flow-regression.test.mjs passed');
