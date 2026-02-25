import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const authContextPath = path.join(root, 'src', 'contexts', 'AuthContext.jsx');
const source = await fs.readFile(authContextPath, 'utf8');

if (!/const\s+\{\s*data:\s*session,\s*isPending,\s*refetch,\s*error:\s*sessionError\s*\}\s*=\s*useSession\(\);/.test(source)) {
  throw new Error('Expected AuthContext to read sessionError from useSession().');
}

if (!/const\s+isTransientSessionError\s*=\s*\(error\)\s*=>/.test(source)) {
  throw new Error('Expected AuthContext to define isTransientSessionError().');
}

if (!/const\s+user\s*=\s*sessionUser\s*\?\?\s*\(sessionErrorIsTransient\s*\?\s*lastKnownUser\s*:\s*null\);/.test(source)) {
  throw new Error('Expected AuthContext to keep lastKnownUser during transient session errors.');
}

if (!/if\s*\(sessionUser\)\s*\{[\s\S]*setLastKnownUser\(sessionUser\);/s.test(source)) {
  throw new Error('Expected AuthContext to refresh lastKnownUser when a session user exists.');
}

if (!/if\s*\(!isPending\s*&&\s*!sessionError\)\s*\{[\s\S]*setLastKnownUser\(null\);/s.test(source)) {
  throw new Error('Expected AuthContext to clear lastKnownUser only when session is settled without error.');
}

if (!/await\s+betterSignOut\(\);[\s\S]*setLastKnownUser\(null\);/s.test(source)) {
  throw new Error('Expected AuthContext to clear lastKnownUser on signOut success.');
}

for (const pattern of [
  "const transient = isTransientSessionError(error);",
  "level: transient ? 'warning' : 'error'",
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected AuthContext auth exception handling to include "${pattern}".`);
  }
}

console.log('auth-session-resilience-regression.test.mjs passed');
