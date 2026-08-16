import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const settingsSource = await read('src/pages/AccountStudySettings.jsx');
const signUpSource = await read('src/pages/SignUp.jsx');

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
  'const EMAIL_PATTERN',
  'id="signup-name"',
  'id="signup-email"',
  'id="signup-password"',
  'Create account',
  "navigate('/dashboard'",
  '{ name: trimmedName }',
]) {
  if (!signUpSource.includes(pattern)) {
    throw new Error(`Expected SignUp to include "${pattern}" for single-screen email signup.`);
  }
}

for (const retired of [
  'Step 1 of 3',
  'OnboardingProgress',
  'total={3}',
  '/onboarding/name',
  'Continue with Email',
  'free credit',
]) {
  if (signUpSource.includes(retired)) {
    throw new Error(`SignUp still references retired onboarding: "${retired}".`);
  }
}

console.log('onboarding-friction-regression.test.mjs passed');
