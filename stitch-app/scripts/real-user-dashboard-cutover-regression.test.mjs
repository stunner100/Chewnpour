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
  profilePageSource,
] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/pages/AccountStudySettings.jsx'),
  read('src/pages/Profile.jsx'),
]);

for (const snippet of [
  'useAuth()',
  'profile?.fullName',
  'profile?.educationLevel',
  'profile?.department',
  'Study workspace',
  'Edit profile',
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
  '/api/billing',
  'remainingUploadCredits',
  'id="profile"',
  'id="subscription"',
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

requireExcludes(profilePageSource, 'Sign Out', 'Profile.jsx');
requireIncludes(profilePageSource, 'Navigate to="/dashboard/settings#profile"', 'Profile.jsx');
requireExcludes(profilePageSource, "from 'convex/react'", 'Profile.jsx');

console.log('real-user-dashboard-cutover-regression.test.mjs passed');
