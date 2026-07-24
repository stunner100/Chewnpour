import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const profilePath = path.join(root, 'src', 'pages', 'Profile.jsx');
const source = await fs.readFile(profilePath, 'utf8');

if (!source.includes('Navigate to="/dashboard/settings#profile"')) {
  throw new Error('Expected Profile.jsx to hard-redirect to settings#profile.');
}

if (/showAllExamAttempts|visibleExamAttempts|\/dashboard\/analysis/.test(source)) {
  throw new Error('Profile.jsx should not retain exam-attempt UI after redirect cutover.');
}

console.log('profile-exam-view-all-regression.test.mjs passed');
