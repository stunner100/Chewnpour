import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  fs.readFile(path.join(root, relativePath), 'utf8');

const dashboardSource = await read('src/pages/DashboardAnalysis.jsx');
for (const pattern of [
  'if (!isConvexAuthenticated) {',
  "reason: 'convex_auth_not_ready'",
  'isConvexAuthenticationError(error)',
  "'Upload blocked because session auth is not ready.'",
]) {
  if (!dashboardSource.includes(pattern)) {
    throw new Error(`Expected DashboardAnalysis to include "${pattern}".`);
  }
}

const assignmentSource = await read('src/pages/AssignmentHelper.jsx');
for (const pattern of [
  'if (!isConvexAuthenticated) {',
  "reason: 'convex_auth_not_ready'",
  'isConvexAuthenticationError(uploadError)',
  "'Assignment upload blocked because session auth is not ready.'",
]) {
  if (!assignmentSource.includes(pattern)) {
    throw new Error(`Expected AssignmentHelper to include "${pattern}".`);
  }
}

const uploadsSource = await read('convex/uploads.ts');
for (const pattern of [
  'const isAuthenticationError = (error: unknown) => {',
  'code: "UNAUTHENTICATED"',
  'You must be signed in to upload files.',
  'await ctx.storage.delete(args.storageId).catch(() => undefined);',
]) {
  if (!uploadsSource.includes(pattern)) {
    throw new Error(`Expected convex/uploads.ts to include "${pattern}".`);
  }
}

const assignmentsSource = await read('convex/assignments.ts');
for (const pattern of [
  'const isAuthenticationError = (error: unknown) => {',
  'await ctx.storage.delete(args.storageId).catch(() => undefined);',
]) {
  if (!assignmentsSource.includes(pattern)) {
    throw new Error(`Expected convex/assignments.ts to include "${pattern}".`);
  }
}

console.log('upload-auth-resilience-regression.test.mjs passed');
