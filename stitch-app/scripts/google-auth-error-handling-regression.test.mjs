import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const authConfigPath = path.join(root, 'convex', 'authConfig.ts');
const authConfigSource = await fs.readFile(authConfigPath, 'utf8');

if (!/process\.env\.FRONTEND_URLS/.test(authConfigSource)) {
  throw new Error('Expected convex/authConfig.ts to support FRONTEND_URLS for explicit trusted origins.');
}

if (!/const\s+isLocalhostOrigin\s*=\s*\(origin:\s*string\)\s*=>/.test(authConfigSource)) {
  throw new Error('Expected convex/authConfig.ts to declare an isLocalhostOrigin helper.');
}

if (!/isLocalhostOrigin\(dynamicOrigin\)/.test(authConfigSource)) {
  throw new Error('Expected convex/authConfig.ts to trust dynamic localhost origins.');
}

const signUpPath = path.join(root, 'src', 'pages', 'SignUp.jsx');
const signUpSource = await fs.readFile(signUpPath, 'utf8');

if (!/const\s+\[error,\s*setError\]\s*=\s*React\.useState\(''\);/.test(signUpSource)) {
  throw new Error('Expected SignUp page to track google sign-in errors.');
}

if (!/const\s+\{\s*error:\s*signInError\s*\}\s*=\s*await\s+signInWithGoogle\(\);/.test(signUpSource)) {
  throw new Error('Expected SignUp page to read signInWithGoogle error responses.');
}

if (!/if\s*\(signInError\)\s*\{\s*setError\(/s.test(signUpSource)) {
  throw new Error('Expected SignUp page to surface sign-in errors to users.');
}

if (!/normalized\s*===\s*'load failed'\s*\|\|\s*normalized\s*===\s*'failed to fetch'/.test(signUpSource)) {
  throw new Error('Expected SignUp page to map network auth failures to a user-friendly error message.');
}

if (!/finally\s*\{\s*setLoading\(false\);\s*\}/s.test(signUpSource)) {
  throw new Error('Expected SignUp page to always reset loading state.');
}

const loginPath = path.join(root, 'src', 'pages', 'Login.jsx');
const loginSource = await fs.readFile(loginPath, 'utf8');

if (!/const\s+resolveGoogleErrorMessage\s*=\s*\(authError\)\s*=>/.test(loginSource)) {
  throw new Error('Expected Login page to define resolveGoogleErrorMessage for Google sign-in errors.');
}

if (!/normalized\s*===\s*'load failed'\s*\|\|\s*normalized\s*===\s*'failed to fetch'/.test(loginSource)) {
  throw new Error('Expected Login page to map network Google sign-in failures to a user-friendly message.');
}

if (!/const\s+\{\s*error:\s*signInError\s*\}\s*=\s*await\s+signInWithGoogle\(\);/.test(loginSource)) {
  throw new Error('Expected Login page to read signInWithGoogle error responses.');
}

if (!/if\s*\(signInError\)\s*\{\s*setError\(resolveGoogleErrorMessage\(signInError\)\);/.test(loginSource)) {
  throw new Error('Expected Login page to surface mapped Google sign-in errors to users.');
}

if (!/catch\s*\{\s*setError\('Unable to reach authentication right now\. Please try again\.'\);\s*\}/s.test(loginSource)) {
  throw new Error('Expected Login page to handle thrown Google sign-in network errors.');
}

if (!/finally\s*\{\s*setLoading\(false\);\s*\}/s.test(loginSource)) {
  throw new Error('Expected Login page to always reset loading state after Google sign-in attempts.');
}

console.log('google-auth-error-handling-regression.test.mjs passed');
