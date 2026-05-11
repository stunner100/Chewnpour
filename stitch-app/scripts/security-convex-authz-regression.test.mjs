import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const forbiddenPublicExports = [
  ["convex/devAuth.ts", /export\s+const\s+devDeleteUserByEmail\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+upgradeToPremium\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+upsertSubscription\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+cancelSubscription\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeAiMessageCreditOrThrow\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeVoiceGenerationCreditOrThrow\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeReExplainCreditOrThrow\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeHumanizerCreditOrThrow\s*=\s*mutation\(/],
  ["convex/extraction.ts", /export\s+const\s+smokeDoclingExtraction\s*=\s*action\(/],
  ["convex/topicChat.ts", /export\s+const\s+appendAssistantMessage\s*=\s*mutation\(/],
  ["convex/uploads.ts", /export\s+const\s+updateUploadStatus\s*=\s*mutation\(/],
];

for (const [file, pattern] of forbiddenPublicExports) {
  assert.equal(pattern.test(read(file)), false, `${file} still exposes a public dangerous function`);
}

const authzSource = read("convex/lib/authz.ts");
for (const snippet of [
  "export const requireAuthenticatedUserId",
  "export const assertOwnerUserId",
  "export const getAuthenticatedUserIdOrNull",
  "collectAuthUserIdCandidates",
]) {
  assert.ok(authzSource.includes(snippet), `authz helper missing ${snippet}`);
}

const publicUserIdArgChecks = [
  ["convex/courses.ts", /userId:\s*v\.string\(\)/],
  ["convex/uploads.ts", /args:\s*\{\s*userId:/],
  ["convex/assignments.ts", /userId:\s*v\.string\(\)/],
  ["convex/courseFolders.ts", /userId:\s*v\.string\(\)/],
  ["convex/community.ts", /userId:\s*v\.string\(\)/],
];

for (const [file, pattern] of publicUserIdArgChecks) {
  assert.equal(pattern.test(read(file)), false, `${file} still accepts userId as public authority`);
}

console.log("security-convex-authz-regression.test.mjs passed");
