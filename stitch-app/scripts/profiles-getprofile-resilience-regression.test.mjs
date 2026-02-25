import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const profilesPath = path.join(root, 'convex', 'profiles.ts');
const source = await fs.readFile(profilesPath, 'utf8');

if (!source.includes('const normalizeUserId =')) {
  throw new Error('Expected convex/profiles.ts to normalize user IDs before querying.');
}

if (!source.includes('args: { userId: v.optional(v.any()) }')) {
  throw new Error('Expected getProfile args to accept optional any() for resilient client payload handling.');
}

if (!source.includes('const identity = await ctx.auth.getUserIdentity().catch(() => null);')) {
  throw new Error('Expected getProfile to safely read auth identity.');
}

if (!source.includes('if (explicitUserId && authenticatedUserId && explicitUserId !== authenticatedUserId)')) {
  throw new Error('Expected getProfile to guard against explicit cross-user lookups.');
}

if (!source.includes('[profiles:getProfile] Failed to read profile')) {
  throw new Error('Expected getProfile to log failures with context.');
}

if (!source.includes('return null;')) {
  throw new Error('Expected getProfile to fail closed with null on backend read errors.');
}

console.log('profiles-getprofile-resilience-regression.test.mjs passed');
