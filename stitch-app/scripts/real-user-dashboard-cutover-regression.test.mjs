import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`${label} should not include mock-only snippet "${snippet}".`);
  }
};

const [
  dashboardPageSource,
  settingsPageSource,
] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/pages/AccountStudySettings.jsx'),
]);

for (const snippet of [
  'useAuth()',
  'profile?.fullName',
  '/dashboard/library',
]) {
  requireIncludes(dashboardPageSource, snippet, 'StudentDashboard.jsx');
}

for (const snippet of [
  'Good morning, Alex.',
  'api.profiles.getUserStats',
  'api.courses.getUserCourses',
  "from 'convex/react'",
]) {
  requireExcludes(dashboardPageSource, snippet, 'StudentDashboard.jsx');
}

for (const snippet of [
  'useAuth()',
  'updateProfile({',
  'preferredPersona: normalizedAiTone',
  'id="profile"',
  'id="subscription"',
  'ChewnPour is free',
  'signOut',
  "navigate('/login'",
  'Sign Out',
]) {
  requireIncludes(settingsPageSource, snippet, 'AccountStudySettings.jsx');
}

for (const snippet of [
  "from 'convex/react'",
  'api.tutor.getTutorProfile',
  'api.tutor.setTutorPersona',
  'api.subscriptions.getSubscription',
  'Oct 15, 2024',
]) {
  requireExcludes(settingsPageSource, snippet, 'AccountStudySettings.jsx');
}

console.log('real-user-dashboard-cutover-regression.test.mjs passed');
