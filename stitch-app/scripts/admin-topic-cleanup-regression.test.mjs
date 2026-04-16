import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const adminPath = path.join(root, "convex", "adminTopics.ts");
const topicsPath = path.join(root, "convex", "topics.ts");

const [adminSource, topicsSource] = await Promise.all([
  fs.readFile(adminPath, "utf8"),
  fs.readFile(topicsPath, "utf8"),
]);

if (!/export const deleteTopicCascadeInternal = internalMutation\(/.test(topicsSource)) {
  throw new Error("Expected convex/topics.ts to define deleteTopicCascadeInternal.");
}

if (!/await ctx\.storage\.delete\(topic\.illustrationStorageId\);/.test(topicsSource)) {
  throw new Error("Expected topic cascade deletion to remove stored illustrations.");
}

if (!/export const deleteTopicAsAdmin = mutation\(/.test(adminSource)) {
  throw new Error("Expected convex/adminTopics.ts to define deleteTopicAsAdmin.");
}

if (!/await ctx\.runQuery\(internal\.admin\.getAdminAccessStatusInternal, \{\}\);/.test(adminSource)) {
  throw new Error("Expected admin topic cleanup to verify admin access through internal.admin.getAdminAccessStatusInternal.");
}

if (!/confirmTitle: v\.string\(\)/.test(adminSource) || !/if \(confirmTitle !== topicTitle\) \{\s*throw new Error\("Topic title confirmation mismatch\."\);\s*\}/s.test(adminSource)) {
  throw new Error("Expected admin topic cleanup to require a matching topic title confirmation.");
}

if (!/await ctx\.runMutation\(internal\.topics\.deleteTopicCascadeInternal, \{ topicId: args\.topicId \}\);/.test(adminSource)) {
  throw new Error("Expected admin topic cleanup to delegate to deleteTopicCascadeInternal.");
}

console.log("admin-topic-cleanup-regression.test.mjs passed");
