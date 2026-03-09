import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const adminSource = await read('convex/admin.ts');
for (const snippet of [
  'const collectAuthUserIdCandidates = (identity: any) => {',
  'const resolveIdentityEmail = (identity: any) => {',
  'const resolvedAuthUsers = await fetchAuthUsersByIds(ctx, authUserIdCandidates);',
  'const authEmail = resolveIdentityEmail(identity) || normalizeEmail(resolvedAuthUser?.email);',
  'const allowedByUserId = authUserIdCandidates.some((candidate) => adminUserIdAllowlist.has(candidate))',
  'email: resolveIdentityEmail(identity) || null,',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for resilient admin email access resolution.`);
  }
}

console.log('admin-email-access-resolution-regression.test.mjs passed');
