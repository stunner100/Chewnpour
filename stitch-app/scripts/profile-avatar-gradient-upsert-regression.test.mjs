import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const editProfilePath = path.join(root, 'src', 'pages', 'EditProfile.jsx');
const settingsPath = path.join(root, 'src', 'pages', 'AccountStudySettings.jsx');
const appPath = path.join(root, 'src', 'App.jsx');
const profilesPath = path.join(root, 'server', 'profiles.js');

try {
  await fs.access(editProfilePath);
  throw new Error('EditProfile.jsx should be deleted; profile editing lives in Settings.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const [settingsSource, appSource, profilesSource] = await Promise.all([
  fs.readFile(settingsPath, 'utf8'),
  fs.readFile(appPath, 'utf8'),
  fs.readFile(profilesPath, 'utf8'),
]);

if (!settingsSource.includes('id="profile"')) {
  throw new Error('Settings should own the profile section after EditProfile cutover.');
}

if (!appSource.includes('<Route path="/profile/edit" element={<Navigate to="/dashboard/settings#profile" replace />} />')) {
  throw new Error('Legacy /profile/edit should redirect to Settings profile.');
}

if (appSource.includes("import('./pages/EditProfile')") || appSource.includes('const EditProfile = lazyRoute')) {
  throw new Error('App should not mount EditProfile.');
}

if (!profilesSource.includes('"avatarGradient"') || !profilesSource.includes('avatar_gradient')) {
  throw new Error('Server profiles API should still accept avatarGradient for storage compatibility.');
}

console.log('profile-avatar-gradient-upsert-regression.test.mjs passed');
