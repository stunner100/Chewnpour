import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const layoutSource = await read('src/components/DashboardLayout.jsx');
const settingsSource = await read('src/pages/AccountStudySettings.jsx');

for (const expectedSnippet of [
  "const SUPPORT_EMAIL = 'info@chewnpour.com';",
  'const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=ChewnPour%20Support`;',
  'href={SUPPORT_MAILTO}',
  'aria-label={`Email support at ${SUPPORT_EMAIL}`}',
  'to="/dashboard/settings#notifications"',
  'aria-label="Open notification settings"',
  'to="/dashboard/settings"',
  'aria-label="Open settings"',
  'target.scrollIntoView({ behavior: \'smooth\', block: \'start\' });',
]) {
  if (!layoutSource.includes(expectedSnippet)) {
    throw new Error(`Expected DashboardLayout.jsx to include "${expectedSnippet}".`);
  }
}

if (layoutSource.includes('to="/dashboard/ai-tutor"')) {
  throw new Error('Regression detected: help icon should email support, not route to AI Tutor.');
}

if (!/\{\/\* Notifications \*\/\}\s*<section id="notifications" className="scroll-mt-20/.test(settingsSource)) {
  throw new Error('Expected settings page to expose a scroll target for notification settings.');
}

console.log('dashboard-header-actions-regression.test.mjs passed');
