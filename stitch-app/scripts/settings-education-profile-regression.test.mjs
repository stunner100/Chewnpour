import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const settingsSource = await read('src/pages/AccountStudySettings.jsx');
const dashboardSource = await read('src/pages/StudentDashboard.jsx');

for (const expectedSnippet of [
  'const EDUCATION_LEVELS = [',
  'const DEPARTMENTS = [',
  'id="settings-education-level"',
  'id="settings-department"',
  'educationLevel: normalizedEducationLevel || null',
  'department: normalizedDepartment || null',
  'onboardingCompleted: true',
  'Education Level',
  'Department',
]) {
  if (!settingsSource.includes(expectedSnippet)) {
    throw new Error(`Expected AccountStudySettings.jsx to include "${expectedSnippet}".`);
  }
}

if (!dashboardSource.includes('isFirstRun')) {
  throw new Error('Empty dashboard should use a first-run upload coach instead of a profile banner.');
}

if (dashboardSource.includes('Finish setting up your profile')) {
  throw new Error('Dashboard must not nag new users to finish education profile before first value.');
}

if (settingsSource.includes('AppIcon name="edit"')) {
  throw new Error('Settings profile should not show a non-functional avatar edit control.');
}

if (settingsSource.includes('group-hover:scale-105')) {
  throw new Error('Settings profile should not keep the decorative avatar edit affordance.');
}

console.log('settings-education-profile-regression.test.mjs passed');
