import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const topicIllustrationLibPath = path.join(root, "src", "lib", "topicIllustration.js");
const topicContentPanelPath = path.join(root, "src", "components", "topic", "TopicContentPanel.jsx");
const topicHookPath = path.join(root, "src", "hooks", "useTopicDetail.js");
const placeholderAssetPath = path.join(root, "public", "topic-placeholder.svg");
const envExamplePath = path.join(root, ".env.example");

const [
    topicIllustrationLibSource,
    topicContentPanelSource,
    topicHookSource,
    envExampleSource,
] = await Promise.all([
    fs.readFile(topicIllustrationLibPath, "utf8"),
    fs.readFile(topicContentPanelPath, "utf8"),
    fs.readFile(topicHookPath, "utf8"),
    fs.readFile(envExamplePath, "utf8"),
]);

await fs.access(placeholderAssetPath);

if (!/resolveTopicIllustrationUrl/.test(topicIllustrationLibSource)) {
    throw new Error("Expected src/lib/topicIllustration.js to export resolveTopicIllustrationUrl.");
}

if (!/isPlaceholderTopicIllustration/.test(topicIllustrationLibSource)) {
    throw new Error("Expected src/lib/topicIllustration.js to export isPlaceholderTopicIllustration.");
}

if (
    !/showTopicIllustration && topicIllustrationUrl/.test(topicContentPanelSource)
    || !/isPlaceholderTopicIllustration/.test(topicHookSource)
) {
    throw new Error("Expected lesson page to hide placeholder illustrations and only show real topic art.");
}

if (!/TOPIC_ILLUSTRATION_GENERATION_ENABLED=false/.test(envExampleSource)) {
    throw new Error("Expected .env.example to include TOPIC_ILLUSTRATION_GENERATION_ENABLED=false.");
}

if (!/TOPIC_PLACEHOLDER_ILLUSTRATION_URL=\/topic-placeholder\.svg/.test(envExampleSource)) {
    throw new Error("Expected .env.example to include TOPIC_PLACEHOLDER_ILLUSTRATION_URL=/topic-placeholder.svg.");
}

console.log("topic-illustration-placeholder-regression.test.mjs passed");
