import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const conceptsSource = await fs.readFile(path.join(root, 'convex', 'concepts.ts'), 'utf8');

const queryMatch = conceptsSource.match(
  /export const getUserConceptAttempts = query\(\{[\s\S]*?\n\}\);/m,
);
if (!queryMatch) {
  throw new Error('getUserConceptAttempts query not found.');
}

const querySource = queryMatch[0];

if (!/const identity = await ctx\.auth\.getUserIdentity\(\);/.test(querySource)) {
  throw new Error('Expected getUserConceptAttempts to read authenticated identity.');
}

if (!/if \(!authUserId\) return \[];/.test(querySource)) {
  throw new Error('Expected getUserConceptAttempts to return an empty list when auth identity is unavailable.');
}

if (/assertAuthorizedUser\(\{\s*authUserId\s*\}\)/.test(querySource)) {
  throw new Error('getUserConceptAttempts must not throw on transient missing auth identity.');
}

if (!/\.withIndex\("by_userId", \(q\) => q\.eq\("userId", userId\)\)/.test(querySource)) {
  throw new Error('Expected getUserConceptAttempts to query by authenticated userId.');
}

console.log('concept-attempt-query-auth-resilience-regression.test.mjs passed');
