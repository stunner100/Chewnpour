import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const migration = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724121000_profiles.sql'),
  'utf8',
);
if (!/CREATE TABLE IF NOT EXISTS "profiles"/.test(migration)) {
  throw new Error('Expected profiles migration to create the profiles table.');
}
if (!/REFERENCES "user"\("id"\) ON DELETE CASCADE/.test(migration)) {
  throw new Error('Expected profiles.user_id to reference Better Auth user ids.');
}

const profilesSource = await fs.readFile(path.join(root, 'server', 'profiles.js'), 'utf8');
for (const symbol of ['ensureProfile', 'getProfileForUser', 'updateProfileForUser']) {
  if (!profilesSource.includes(`export const ${symbol}`)) {
    throw new Error(`Expected server/profiles.js to export ${symbol}.`);
  }
}

const profileHttp = await fs.readFile(path.join(root, 'server', 'profileHttp.js'), 'utf8');
if (!/handleProfileRequest/.test(profileHttp) || !/auth\.api\.getSession/.test(profileHttp)) {
  throw new Error('Expected profile HTTP handler to require a Better Auth session.');
}

const apiRouter = await fs.readFile(path.join(root, 'api', 'router.js'), 'utf8');
if (!/pathname === "\/api\/profile"[\s\S]*?return handleProfileRequest\(req, res\);/.test(apiRouter)) {
  throw new Error('Expected api/router.js to route /api/profile to the profile HTTP handler.');
}

const authContext = await fs.readFile(path.join(root, 'src', 'contexts', 'AuthContext.jsx'), 'utf8');
if (!/fetch\('\/api\/profile'/.test(authContext)) {
  throw new Error('Expected AuthContext to load profiles from /api/profile.');
}
if (/buildMilestoneProfile/.test(authContext)) {
  throw new Error('Expected AuthContext to stop using the stub milestone profile builder.');
}

const settings = await fs.readFile(path.join(root, 'src', 'pages', 'AccountStudySettings.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(settings)) {
  throw new Error('Expected AccountStudySettings to stop depending on Convex.');
}
if (!/preferredPersona/.test(settings) || !/updateProfile\(/.test(settings)) {
  throw new Error('Expected AccountStudySettings to persist tutor prefs via updateProfile.');
}

const viteConfig = await fs.readFile(path.join(root, 'vite.config.js'), 'utf8');
if (!/['"]\/api\/profile['"]/.test(viteConfig)) {
  throw new Error('Expected Vite to proxy /api/profile to the local API server.');
}

console.log('supabase-profiles-milestone-regression.test.mjs passed');
