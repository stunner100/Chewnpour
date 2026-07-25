import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

try {
  await fs.access(path.join(root, 'src/pages/EditProfile.jsx'));
  throw new Error('EditProfile.jsx must stay deleted after the settings cutover.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const appSource = await fs.readFile(path.join(root, 'src/App.jsx'), 'utf8');
if (appSource.includes("import('./pages/EditProfile')")) {
  throw new Error('App must not lazy-load EditProfile.');
}
if (!appSource.includes('path="/profile/edit"') || !appSource.includes('/dashboard/settings#profile')) {
  throw new Error('Legacy profile edit route must redirect to Settings.');
}

console.log('edit-profile-cutover-regression.test.mjs passed');
