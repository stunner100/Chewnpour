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
  '/onboarding/level',
  'Users without saved onboarding progress should resume at level.'
);

assert.equal(
  resolveOnboardingPath({ educationLevel: 'junior', onboardingCompleted: false }),
  '/onboarding/department',
  'Users with a saved education level should resume at department.'
);

assert.equal(
  resolveOnboardingPath({ educationLevel: 'junior', onboardingCompleted: true }),
  '/dashboard',
  'Completed onboarding should resolve to the dashboard.'
);

const protectedRouteSource = await fs.readFile(
  path.join(rootDir, 'src/components/ProtectedRoute.jsx'),
  'utf8'
);

assert.match(
  protectedRouteSource,
  /loading && user && profileReady/,
  'ProtectedRoute should only bypass the loading screen when the profile gate is ready.'
);

assert.match(
  protectedRouteSource,
  /resolveOnboardingPath\(profile\)/,
  'ProtectedRoute should use shared onboarding path resolution.'
);

const onboardingLevelSource = await fs.readFile(
  path.join(rootDir, 'src/pages/OnboardingLevel.jsx'),
  'utf8'
);

assert.match(
  onboardingLevelSource,
  /resolveOnboardingPath\(profile\)/,
  'OnboardingLevel should redirect forward when the user already has saved level progress.'
);

console.log('onboarding-resume-routing-regression: ok');
