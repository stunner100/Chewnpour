import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const providersPath = path.join(workspaceRoot, 'src', 'bootstrap', 'AppProviders.jsx');
const source = await fs.readFile(providersPath, 'utf8');

if (/ConvexBetterAuthProvider|ConvexReactClient|@convex-dev\/better-auth/.test(source)) {
  throw new Error('Expected AppProviders.jsx to stop wrapping the app in Convex auth providers.');
}

if (!/import\s+\{\s*AuthProvider\s*\}\s+from\s+['"]\.\.\/contexts\/AuthContext\.jsx['"]/.test(source)) {
  throw new Error('Expected AppProviders.jsx to mount AuthProvider.');
}

if (!/<AuthProvider>/.test(source) || !/<App\s*\/>/.test(source)) {
  throw new Error('Expected AppProviders.jsx to render AuthProvider around App.');
}

console.log('convex-auth-provider-regression.test.mjs passed');
