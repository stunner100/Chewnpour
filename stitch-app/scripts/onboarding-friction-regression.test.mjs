import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const settingsSource = await read('src/pages/AccountStudySettings.jsx');
const onboardingNameSource = await read('src/pages/OnboardingName.jsx');

for (const pattern of [
  'id="settings-education-level"',
  'id="settings-department"',
  'onboardingCompleted: true',
  'Education Level',
  'Department',
]) {
  if (!settingsSource.includes(pattern)) {
    throw new Error(`Expected AccountStudySettings to include "${pattern}" for profile education setup.`);
  }
}

for (const pattern of [
  "const NAME_FORM_ID = 'onboarding-name-form';",
  'const EMAIL_PATTERN',
  'form={NAME_FORM_ID}',
  'fixed bottom-0 left-0 w-full',
  'Step 1 of 3',
  'isEmailValid',
  'isPasswordValid',
  'Valid email address.',
  'At least 6 characters required.',
]) {
  if (!onboardingNameSource.includes(pattern)) {
    throw new Error(`Expected OnboardingName to include "${pattern}" for visible submit support.`);
  }
}

console.log('onboarding-friction-regression.test.mjs passed');
