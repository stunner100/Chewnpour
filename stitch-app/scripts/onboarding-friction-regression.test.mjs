import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const onboardingDepartmentSource = await read('src/pages/OnboardingDepartment.jsx');
const onboardingNameSource = await read('src/pages/OnboardingName.jsx');

for (const pattern of [
  'type="button"',
  'aria-pressed={isSelected}',
  'onClick={() => handleToggle(dept.value)}',
  'grid grid-cols-1 sm:grid-cols-2',
  'w-full min-h-14',
]) {
  if (!onboardingDepartmentSource.includes(pattern)) {
    throw new Error(`Expected OnboardingDepartment to include "${pattern}" for responsive subject toggles.`);
  }
}

for (const pattern of [
  "const NAME_FORM_ID = 'onboarding-name-form';",
  'const EMAIL_PATTERN',
  'form={NAME_FORM_ID}',
  "event.key === 'Enter'",
  'requestSubmit()',
  'fixed bottom-0 left-0 w-full',
  'Step 1 of 3',
  'isEmailValid',
  'isPasswordValid',
  'Valid email address.',
  'At least 6 characters required.',
]) {
  if (!onboardingNameSource.includes(pattern)) {
    throw new Error(`Expected OnboardingName to include "${pattern}" for visible submit and Enter-key support.`);
  }
}

console.log('onboarding-friction-regression.test.mjs passed');
