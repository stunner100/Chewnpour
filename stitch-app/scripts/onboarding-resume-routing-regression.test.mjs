import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const onboardingModule = await import(
  pathToFileURL(path.join(rootDir, 'src/lib/onboarding.js')).href
);

const { resolveOnboardingPath } = onboardingModule;

assert.equal(
  resolveOnboardingPath(null),
  '/dashboard',
  'Users without a profile should still reach the dashboard.',
);

assert.equal(
  resolveOnboardingPath({ educationLevel: 'junior', onboardingCompleted: false }),
  '/dashboard',
  'Incomplete education details must not force the retired onboarding steps.',
);

assert.equal(
  resolveOnboardingPath({ educationLevel: 'junior', onboardingCompleted: true }),
  '/dashboard',
  'Completed onboarding should resolve to the dashboard.',
);

const protectedRouteStateSource = await fs.readFile(
  path.join(rootDir, 'src/lib/protectedRouteState.js'),
  'utf8',
);

assert.match(
  protectedRouteStateSource,
  /resolveOnboardingPath\(profile\)/,
  'Protected route state should use shared onboarding path resolution.',
);

const appSource = await fs.readFile(path.join(rootDir, 'src/App.jsx'), 'utf8');

assert.match(
  appSource,
  /path="\/onboarding\/level"[\s\S]*Navigate to="\/dashboard\/settings#profile"/,
  'Legacy /onboarding/level should redirect to Settings profile.',
);

assert.match(
  appSource,
  /path="\/onboarding\/department"[\s\S]*Navigate to="\/dashboard\/settings#profile"/,
  'Legacy /onboarding/department should redirect to Settings profile.',
);

assert.doesNotMatch(
  appSource,
  /import\('\.\/pages\/OnboardingLevel'\)/,
  'App should not mount the retired OnboardingLevel page.',
);

assert.doesNotMatch(
  appSource,
  /import\('\.\/pages\/OnboardingDepartment'\)/,
  'App should not mount the retired OnboardingDepartment page.',
);

console.log('onboarding-resume-routing-regression: ok');
