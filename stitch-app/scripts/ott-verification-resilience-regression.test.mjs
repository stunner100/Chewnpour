import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const authContextPath = path.join(root, 'src', 'contexts', 'AuthContext.jsx');
const source = await fs.readFile(authContextPath, 'utf8');

if (!/const\s+isIgnorableOttError\s*=\s*\(error\)\s*=>/.test(source)) {
  throw new Error('Expected AuthContext to define an isIgnorableOttError helper for OTT verification.');
}

if (!/const\s+shouldRecoverFromOttError\s*=\s*\(error\)\s*=>/.test(source)) {
  throw new Error('Expected AuthContext to define shouldRecoverFromOttError for OTT recovery.');
}

if (!/isIgnorableOttError\(error\)\s*\|\|\s*isTransientSessionError\(error\)/.test(source)) {
  throw new Error('Expected OTT recovery guard to include ignorable token and transient network failures.');
}

if (!/invalid token/.test(source) || !/expired token/.test(source)) {
  throw new Error('Expected AuthContext OTT guard to recognize invalid/expired token failures.');
}

if (!/const\s+verifyOttTokenWithRetry\s*=\s*async\s*\(token,\s*maxRetries\s*=\s*1\)\s*=>/.test(source)) {
  throw new Error('Expected AuthContext to retry OTT verification for transient failures.');
}

if (!/isTransientSessionError\(error\)\s*&&\s*attempt\s*<\s*maxRetries/.test(source)) {
  throw new Error('Expected OTT retry loop to retry only transient verification failures.');
}

if (!/oneTimeToken\.verify/.test(source)) {
  throw new Error('Expected AuthContext to keep one-time token verification call.');
}

if (!/from\s+['"]\.\.\/lib\/ott['"]/.test(source)) {
  throw new Error('Expected AuthContext to import OTT URL/storage helpers from src/lib/ott.');
}

if (!/consumeOttFromUrl\(\)[\s\S]*persistPendingOttToken\(tokenFromUrl\)[\s\S]*readPendingOttToken\(\)/s.test(source)) {
  throw new Error('Expected AuthContext to consume ott from URL, stash it, then read the pending OTT token for verification.');
}

if (!/clearPendingOttToken\(\)[\s\S]*setOttPending\(false\)/s.test(source)) {
  throw new Error('Expected AuthContext to clear pending OTT storage and end OTT pending state after verification.');
}

if (!/if\s*\(shouldRecoverFromOttError\(error\)\)\s*\{[\s\S]*await\s+refetch\(\)\.catch\(\(\)\s*=>\s*undefined\)/s.test(source)) {
  throw new Error('Expected AuthContext to recover from ignorable/transient OTT errors by refetching session.');
}

if (!/else\s*\{[\s\S]*captureSentryException\(/s.test(source)) {
  throw new Error('Expected AuthContext to keep exception capture for non-ignorable OTT failures.');
}

console.log('ott-verification-resilience-regression.test.mjs passed');
