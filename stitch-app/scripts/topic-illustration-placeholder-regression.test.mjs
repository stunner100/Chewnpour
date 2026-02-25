import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const aiPath = path.join(root, "convex", "ai.ts");
const topicsPath = path.join(root, "convex", "topics.ts");
const dashboardCoursePath = path.join(root, "src", "pages", "DashboardCourse.jsx");
const topicDetailPath = path.join(root, "src", "pages", "TopicDetail.jsx");
const topicIllustrationLibPath = path.join(root, "src", "lib", "topicIllustration.js");
const placeholderAssetPath = path.join(root, "public", "topic-placeholder.svg");
const envExamplePath = path.join(root, ".env.example");

const [
    aiSource,
    topicsSource,
    dashboardCourseSource,
    topicDetailSource,
    topicIllustrationLibSource,
    envExampleSource,
] = await Promise.all([
    fs.readFile(aiPath, "utf8"),
    fs.readFile(topicsPath, "utf8"),
    fs.readFile(dashboardCoursePath, "utf8"),
    fs.readFile(topicDetailPath, "utf8"),
    fs.readFile(topicIllustrationLibPath, "utf8"),
    fs.readFile(envExamplePath, "utf8"),
]);

await fs.access(placeholderAssetPath);

if (
    !/TOPIC_ILLUSTRATION_GENERATION_ENABLED/.test(aiSource)
    || !/process\.env\.TOPIC_ILLUSTRATION_GENERATION_ENABLED/.test(aiSource)
    || !/process\.env\.TOPIC_ILLUSTRATION_GENERATION_ENABLED \|\| "false"/.test(aiSource)
) {
    throw new Error("Expected convex/ai.ts to define TOPIC_ILLUSTRATION_GENERATION_ENABLED defaulting to false.");
}

if (!/illustrationUrl:\s*resolveTopicPlaceholderIllustrationUrl\(\)/.test(aiSource)) {
    throw new Error("Expected convex/ai.ts to assign placeholder illustration URL when creating topics.");
}

if (
    !/if\s*\(TOPIC_ILLUSTRATION_GENERATION_ENABLED\)\s*\{\s*await ctx\.scheduler\.runAfter\(0,\s*internal\.ai\.generateTopicIllustration/s.test(aiSource)
) {
    throw new Error("Expected convex/ai.ts to guard topic illustration scheduling behind TOPIC_ILLUSTRATION_GENERATION_ENABLED.");
}

if (!/illustrationUrl:\s*args\.illustrationUrl \|\| resolveDefaultTopicIllustrationUrl\(\)/.test(topicsSource)) {
    throw new Error("Expected convex/topics.ts createTopic to default to a placeholder illustration URL.");
}

if (!/resolveTopicIllustrationUrl/.test(topicIllustrationLibSource)) {
    throw new Error("Expected src/lib/topicIllustration.js to export resolveTopicIllustrationUrl.");
}

if (
    !/src=\{topicIllustrationUrl\}/.test(dashboardCourseSource)
    || !/resolveTopicIllustrationUrl\(topic\.illustrationUrl\)/.test(dashboardCourseSource)
) {
    throw new Error("Expected DashboardCourse to use resolved topic illustration fallback.");
}

if (
    !/src=\{topicIllustrationUrl\}/.test(topicDetailSource)
    || !/resolveTopicIllustrationUrl\(topic\?\.illustrationUrl\)/.test(topicDetailSource)
) {
    throw new Error("Expected TopicDetail to use resolved topic illustration fallback.");
}

if (!/TOPIC_ILLUSTRATION_GENERATION_ENABLED=false/.test(envExampleSource)) {
    throw new Error("Expected .env.example to include TOPIC_ILLUSTRATION_GENERATION_ENABLED=false.");
}

if (!/TOPIC_PLACEHOLDER_ILLUSTRATION_URL=\/topic-placeholder\.svg/.test(envExampleSource)) {
    throw new Error("Expected .env.example to include TOPIC_PLACEHOLDER_ILLUSTRATION_URL=/topic-placeholder.svg.");
}

console.log("topic-illustration-placeholder-regression.test.mjs passed");
