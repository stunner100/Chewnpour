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

if (!dashboardSource.includes('to="/dashboard/settings#profile"')) {
  throw new Error('Complete profile CTA should deep-link to Settings profile.');
}

if (!dashboardSource.includes('onboardingCompleted === true')) {
  throw new Error('Dashboard should hide the complete-profile banner after onboardingCompleted.');
}

if (settingsSource.includes('AppIcon name="edit"')) {
  throw new Error('Settings profile should not show a non-functional avatar edit control.');
}

if (settingsSource.includes('group-hover:scale-105')) {
  throw new Error('Settings profile should not keep the decorative avatar edit affordance.');
}

console.log('settings-education-profile-regression.test.mjs passed');
