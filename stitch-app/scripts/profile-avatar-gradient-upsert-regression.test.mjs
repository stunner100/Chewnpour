import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'convex', 'schema.ts');
const profilesPath = path.join(root, 'convex', 'profiles.ts');
const editProfilePath = path.join(root, 'src', 'pages', 'EditProfile.jsx');

const [schemaSource, profilesSource, editProfileSource] = await Promise.all([
  fs.readFile(schemaPath, 'utf8'),
  fs.readFile(profilesPath, 'utf8'),
  fs.readFile(editProfilePath, 'utf8'),
]);

if (!/avatarGradient:\s*v\.optional\(v\.number\(\)\)/.test(schemaSource)) {
  throw new Error('Regression detected: profiles schema no longer allows avatarGradient.');
}

if (!/avatarGradient:\s*v\.optional\(v\.number\(\)\)/.test(profilesSource)) {
  throw new Error('Regression detected: upsertProfile args no longer accept avatarGradient.');
}

if (!/updates\.avatarGradient\s*=\s*args\.avatarGradient/.test(profilesSource)) {
  throw new Error('Regression detected: upsertProfile does not patch avatarGradient updates.');
}

if (!/avatarGradient:\s*selectedGradient/.test(editProfileSource)) {
  throw new Error('Regression detected: EditProfile no longer submits avatarGradient.');
}

console.log('profile-avatar-gradient-upsert-regression.test.mjs passed');
