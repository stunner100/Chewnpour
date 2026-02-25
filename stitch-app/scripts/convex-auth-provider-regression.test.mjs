import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const mainPath = path.join(workspaceRoot, 'src', 'main.jsx');
const source = await fs.readFile(mainPath, 'utf8');

const hasConvexBetterAuthProviderImport =
  /import\s+\{\s*ConvexBetterAuthProvider\s*\}\s+from\s+["']@convex-dev\/better-auth\/react["']/.test(source);
if (!hasConvexBetterAuthProviderImport) {
  throw new Error('Expected src/main.jsx to import ConvexBetterAuthProvider from @convex-dev/better-auth/react.');
}

const hasAuthClientImport =
  /import\s+\{\s*authClient\s*\}\s+from\s+["']\.\/lib\/auth-client\.js["']/.test(source);
if (!hasAuthClientImport) {
  throw new Error('Expected src/main.jsx to import authClient from ./lib/auth-client.js.');
}

const usesBetterAuthProvider =
  /<ConvexBetterAuthProvider\s+client=\{convex\}\s+authClient=\{authClient\}>/.test(source);
if (!usesBetterAuthProvider) {
  throw new Error('Expected src/main.jsx to initialize ConvexBetterAuthProvider with client={convex} and authClient={authClient}.');
}

const usesPlainConvexProvider =
  /<ConvexProvider\s+client=\{convex\}>/.test(source);
if (usesPlainConvexProvider) {
  throw new Error('Regression detected: src/main.jsx still uses plain ConvexProvider for the authenticated app tree.');
}

console.log('convex-auth-provider-regression.test.mjs passed');
