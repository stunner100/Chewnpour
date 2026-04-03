import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const topicsSource = await fs.readFile(path.join(root, "convex", "topics.ts"), "utf8");

const createQuestionMatch = topicsSource.match(
    /export const createQuestionInternal = internalMutation\(\{[\s\S]*?handler: async \(ctx, args\) => \{([\s\S]*?)\n\s*\},\n\}\);/
);

if (!createQuestionMatch) {
    throw new Error("Expected convex/topics.ts to define createQuestionInternal.");
}

const createQuestionBody = createQuestionMatch[1];

if (!/const topic = await ctx\.db\.get\(args\.topicId\);/.test(createQuestionBody)) {
    throw new Error("Expected createQuestionInternal to load the topic before persisting generated questions.");
}

if (!/if \(!topic\) \{\s*throw new Error\("Topic not found"\);\s*\}/s.test(createQuestionBody)) {
    throw new Error("Expected createQuestionInternal to reject missing topics before question insertion.");
}

if (!/questionSetVersion:\s*Number\(topic\?\.questionSetVersion \|\| topic\?\.examReadyUpdatedAt \|\| topic\?\._creationTime \|\| 0\) \|\| undefined/.test(createQuestionBody)) {
    throw new Error("Expected createQuestionInternal to derive questionSetVersion from the loaded topic.");
}

console.log("topic-question-context-regression.test.mjs passed");
