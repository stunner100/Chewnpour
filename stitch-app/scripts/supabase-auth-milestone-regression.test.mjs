import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const authClientSource = await fs.readFile(path.join(root, 'src', 'lib', 'auth-client.js'), 'utf8');
if (/@convex-dev\/better-auth|crossDomainClient|convexClient/.test(authClientSource)) {
  throw new Error('Expected auth-client.js to use same-origin Better Auth without Convex plugins.');
}
if (!/createAuthClient/.test(authClientSource) || !/baseURL:\s*authBaseUrl/.test(authClientSource)) {
  throw new Error('Expected auth-client.js to configure createAuthClient with same-origin baseURL.');
}

const appProvidersSource = await fs.readFile(path.join(root, 'src', 'bootstrap', 'AppProviders.jsx'), 'utf8');
if (/ConvexBetterAuthProvider|ConvexReactClient/.test(appProvidersSource)) {
  throw new Error('Expected AppProviders to run without Convex auth providers.');
}

const authServerSource = await fs.readFile(path.join(root, 'server', 'auth.js'), 'utf8');
if (!/betterAuth\(/.test(authServerSource) || !/getPool\(\)/.test(authServerSource)) {
  throw new Error('Expected server/auth.js to configure Better Auth against the shared Postgres pool.');
}
if (!/socialProviders/.test(authServerSource) || !/GOOGLE_CLIENT_ID/.test(authServerSource)) {
  throw new Error('Expected server/auth.js to support Google OAuth when credentials are present.');
}
if (!/ensureProfile/.test(authServerSource)) {
  throw new Error('Expected server/auth.js to create a profile after user signup.');
}

const dbSource = await fs.readFile(path.join(root, 'server', 'db.js'), 'utf8');
if (!/DATABASE_URL/.test(dbSource) || !/export const getPool/.test(dbSource)) {
  throw new Error('Expected server/db.js to expose getPool backed by DATABASE_URL.');
}

const apiRouteSource = await fs.readFile(path.join(root, 'api', 'router.js'), 'utf8');
if (!/toNodeHandler\(auth\)/.test(apiRouteSource) || !/handleGoogleOAuthStart/.test(apiRouteSource)) {
  throw new Error('Expected api/router.js to export toNodeHandler(auth) and intercept google-start.');
}

const migrationSource = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724120000_better_auth_core.sql'),
  'utf8',
);
for (const table of ['"user"', '"session"', '"account"', '"verification"']) {
  if (!migrationSource.includes(table)) {
    throw new Error(`Expected Better Auth migration to create ${table}.`);
  }
}

const dashboardSource = await fs.readFile(path.join(root, 'src', 'pages', 'StudentDashboard.jsx'), 'utf8');
if (/convex\/react|from ['"].*convex/.test(dashboardSource)) {
  throw new Error('Expected StudentDashboard to be Convex-free for the auth milestone.');
}
if (!/useAuth/.test(dashboardSource)) {
  throw new Error('Expected StudentDashboard to read the Better Auth session via useAuth.');
}

const authContextSource = await fs.readFile(path.join(root, 'src', 'contexts', 'AuthContext.jsx'), 'utf8');
if (/useConvexAuth|api\.profiles|crossDomain\.oneTimeToken|buildMilestoneProfile/.test(authContextSource)) {
  throw new Error('Expected AuthContext to stop depending on Convex profiles/OTT/stubs.');
}
if (!/fetch\('\/api\/profile'/.test(authContextSource)) {
  throw new Error('Expected AuthContext to fetch profiles from /api/profile.');
}
if (!/signInWithGoogle/.test(authContextSource) || !/\/api\/auth\/google-start/.test(authContextSource)) {
  throw new Error('Expected AuthContext to keep Google social sign-in via google-start.');
}

console.log('supabase-auth-milestone-regression.test.mjs passed');
