import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => {
  const fullPath = resolve(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

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
  ["convex/courses.ts", ["getUserCourses", "createCourse", "addUploadToCourse", "removeSourceFromCourse", "updateCourse", "deleteCourse"]],
  ["convex/uploads.ts", ["createUpload", "getUserUploads", "getUpload", "deleteUpload"]],
  ["convex/assignments.ts", ["listThreads", "getThreadWithMessages", "createThreadFromUpload", "renameThread", "deleteThread", "appendMessage"]],
  ["convex/courseFolders.ts", ["listFolders", "createFolder", "renameFolder", "deleteFolder", "moveCourseToFolder"]],
  ["convex/community.ts", ["getChannelMembership", "getUserChannels", "createChannelForCourse", "joinChannel", "leaveChannel", "createPost", "flagPost", "joinSeededChannels"]],
];

const exportBlock = (source, exportName) => {
  const marker = `export const ${exportName} = `;
  const start = source.indexOf(marker);
  if (start === -1) return "";
  const next = source.indexOf("\nexport const ", start + marker.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
};

for (const [file, exportNames] of publicUserIdArgChecks) {
  const source = read(file);
  for (const exportName of exportNames) {
    const block = exportBlock(source, exportName);
    assert.ok(block, `${file} is missing public export ${exportName}`);
    assert.equal(
      /userId:\s*v\.string\(\)/.test(block),
      false,
      `${file}#${exportName} still accepts userId as public authority`,
    );
  }
}

console.log("security-convex-authz-regression.test.mjs passed");
