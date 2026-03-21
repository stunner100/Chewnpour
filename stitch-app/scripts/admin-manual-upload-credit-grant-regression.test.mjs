import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const adminSource = await fs.readFile(path.join(root, 'convex', 'admin.ts'), 'utf8');

for (const snippet of [
  'export const grantUploadCreditsByEmail = mutation({',
  'const adminGuard = await requireAdminAccess(ctx);',
  'where: [{ field: "email", value: email }],',
  'withIndex("by_userId_campaignId", (q) => q.eq("userId", userId).eq("campaignId", grantKey))',
  'purchasedUploadCredits: nextPurchasedUploadCredits,',
  'const sourceNote = typeof args.note === "string" && args.note.trim()',
  'source: sourceNote,',
  'alreadyGranted: true,',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for manual upload credit grants.`);
  }
}

console.log('admin-manual-upload-credit-grant-regression.test.mjs passed');
