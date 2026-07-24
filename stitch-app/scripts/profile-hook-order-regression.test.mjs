import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const profilePath = path.join(root, 'src', 'pages', 'Profile.jsx');
const source = await fs.readFile(profilePath, 'utf8');

if (!source.includes('Navigate to="/dashboard/settings#profile"')) {
  throw new Error('Expected Profile.jsx to hard-redirect to settings#profile after Supabase cutover.');
}

if (/from ['"]convex\/react['"]|useQuery|useMutation/.test(source)) {
  throw new Error('Profile.jsx must not retain Convex hooks after cutover.');
}

console.log('profile-hook-order-regression.test.mjs passed');
