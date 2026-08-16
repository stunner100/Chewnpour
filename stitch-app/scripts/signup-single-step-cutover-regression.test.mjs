import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const signUpSource = await read('src/pages/SignUp.jsx');
const appSource = await read('src/App.jsx');

for (const retired of [
  'Step 1 of 3',
  'OnboardingProgress',
  'total={3}',
  'step={1}',
  'Continue with Email',
]) {
  if (signUpSource.includes(retired)) {
    throw new Error(`Signup must not show multi-step onboarding chrome: "${retired}".`);
  }
}

if (!signUpSource.includes('Create account')) {
  throw new Error('Signup CTA should say Create account after the single-step cutover.');
}

if (!signUpSource.includes("navigate('/dashboard'")) {
  throw new Error('Successful signup should go straight to the dashboard.');
}

if (!appSource.includes('RedirectOnboardingNameToSignup')) {
  throw new Error('Legacy /onboarding/name must redirect to /signup.');
}

try {
  await fs.access(path.join(root, 'src/components/onboarding/OnboardingProgress.jsx'));
  throw new Error('OnboardingProgress.jsx should be deleted after the single-step cutover.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

try {
  await fs.access(path.join(root, 'src/pages/OnboardingName.jsx'));
  throw new Error('OnboardingName.jsx should be deleted after signup merged onto /signup.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log('signup-single-step-cutover-regression.test.mjs passed');
