import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const onboardingNameSource = await read('src/pages/OnboardingName.jsx');

for (const retired of [
  'Step 1 of 3',
  'OnboardingProgress',
  'total={3}',
  'step={1}',
]) {
  if (onboardingNameSource.includes(retired)) {
    throw new Error(`Signup must not show multi-step onboarding chrome: "${retired}".`);
  }
}

if (!onboardingNameSource.includes('Create account')) {
  throw new Error('Signup CTA should say Create account after the single-step cutover.');
}

if (!onboardingNameSource.includes("navigate('/dashboard'")) {
  throw new Error('Successful signup should go straight to the dashboard.');
}

try {
  await fs.access(path.join(root, 'src/components/onboarding/OnboardingProgress.jsx'));
  throw new Error('OnboardingProgress.jsx should be deleted after the single-step cutover.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log('signup-single-step-cutover-regression.test.mjs passed');
