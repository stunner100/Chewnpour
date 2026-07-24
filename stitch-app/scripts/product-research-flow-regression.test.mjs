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
  'How are you mainly using the app?',
  'What would you most like us to improve next?',
  'Product research intake is temporarily unavailable',
]) {
  if (!productResearchPage.includes(pattern)) {
    throw new Error(`Expected ProductResearch.jsx to include "${pattern}".`);
  }
}
if (/from ['"]convex\/react['"]|submitResponseByToken/.test(productResearchPage)) {
  throw new Error('Expected ProductResearch.jsx to stay Convex-free while parked.');
}

const profilePage = await read('src/pages/Profile.jsx');
if (!profilePage.includes('Navigate to="/dashboard/settings#profile"')) {
  throw new Error('Expected Profile.jsx to hard-redirect to settings#profile.');
}
for (const forbiddenPattern of ['Product Research', "handleEmailPrefToggle('productResearch')", "from 'convex/react'"]) {
  if (profilePage.includes(forbiddenPattern)) {
    throw new Error(`Expected Profile.jsx to hide "${forbiddenPattern}" from the profile UI.`);
  }
}

const adminPage = await read('src/pages/admin/AdminDashboard.jsx');
for (const pattern of [
  'recentProductResearchResponses',
]) {
  if (!adminPage.includes(pattern)) {
    throw new Error(`Expected admin/AdminDashboard.jsx to include "${pattern}".`);
  }
}

const feedbackPanel = await read('src/pages/admin/panels/FeedbackPanel.jsx');
for (const pattern of [
  'Product Research Responses',
  'additionalNotes',
]) {
  if (!feedbackPanel.includes(pattern)) {
    throw new Error(`Expected FeedbackPanel.jsx to include "${pattern}".`);
  }
}

const appSourceForAdmin = await read('src/App.jsx');
if (!appSourceForAdmin.includes('<Route path="/admin" element={<Navigate to="/dashboard" replace />} />')) {
  throw new Error('Expected /admin to stay parked during Supabase cutover.');
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
