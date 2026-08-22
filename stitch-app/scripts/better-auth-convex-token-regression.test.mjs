import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const authClientSource = await fs.readFile(path.join(root, 'src', 'lib', 'auth-client.js'), 'utf8');
if (/@convex-dev\/better-auth|crossDomainClient|convexClient/.test(authClientSource)) {
  throw new Error('Expected auth-client.js to drop Convex Better Auth plugins after Supabase cutover.');
}
if (!/createAuthClient\(\{\s*baseURL:\s*authBaseUrl/.test(authClientSource)) {
  throw new Error('Expected auth-client.js to use same-origin Better Auth baseURL.');
}

const authServerSource = await fs.readFile(path.join(root, 'server', 'auth.js'), 'utf8');
if (!/from "better-auth"/.test(authServerSource) || !/database:\s*getPool\(\)/.test(authServerSource)) {
  throw new Error('Expected server/auth.js to use Better Auth with a Postgres pool.');
}
if (!/BETTER_AUTH_SECRET/.test(authServerSource) || !/BETTER_AUTH_URL/.test(authServerSource)) {
  throw new Error('Expected server/auth.js to read BETTER_AUTH_SECRET and BETTER_AUTH_URL.');
}

const apiRouteSource = await fs.readFile(path.join(root, 'api', 'router.js'), 'utf8');
if (!/toNodeHandler\(auth\)/.test(apiRouteSource) || !/handleGoogleOAuthStart/.test(apiRouteSource)) {
  throw new Error('Expected api/router.js to mount toNodeHandler(auth) and intercept google-start.');
}

console.log('better-auth-convex-token-regression.test.mjs passed');
