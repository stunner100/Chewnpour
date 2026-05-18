import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'convex', 'admin.ts');
const source = await fs.readFile(adminPath, 'utf8');

const lookupStart = source.indexOf('const fetchAuthUsersByIds = async');
const lookupEnd = source.indexOf('const buildAccessDeniedPayload', lookupStart);
const lookupSource = source.slice(lookupStart, lookupEnd);

if (lookupStart === -1 || lookupEnd === -1) {
  throw new Error('Could not find fetchAuthUsersByIds implementation.');
}

if (!lookupSource.includes('field: "userId"')) {
  throw new Error('Admin auth user lookup should query Better Auth public userId values first.');
}

if (lookupSource.includes('where: [{ field: "_id", operator: "in", value: idChunk }]')) {
  throw new Error('Admin auth user lookup should not batch arbitrary app userIds through Better Auth _id.');
}

if (!lookupSource.includes('catch {')) {
  throw new Error('Admin auth user lookup should tolerate invalid Better Auth _id candidates.');
}

if (!lookupSource.includes('normalizeAuthUserLookupIds')) {
  throw new Error('Admin auth user lookup should map returned users by both _id and userId.');
}

console.log('admin-auth-user-lookup-regression.test.mjs passed');
