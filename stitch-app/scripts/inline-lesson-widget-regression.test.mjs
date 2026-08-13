import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const topicDetail = await fs.readFile(path.join(root, "src/pages/TopicDetail.jsx"), "utf8");
const topicHook = await fs.readFile(path.join(root, "src/hooks/useTopicDetail.js"), "utf8");
const lessonRenderer = await fs.readFile(path.join(root, "src/components/LessonContentRenderer.jsx"), "utf8");

if (!topicHook.includes("type: 'wordbank_widget'")) {
  throw new Error("useTopicDetail must inject an inline word bank widget block.");
}

if (!topicHook.includes("type: 'quickcheck_widget'")) {
  throw new Error("useTopicDetail must inject an inline quick check widget block.");
}

if (!topicHook.includes("type: 'ordering_widget'")) {
  throw new Error("useTopicDetail must inject an inline ordering widget under Quick Check.");
}

if (topicDetail.includes("<InteractiveWordBank")) {
  throw new Error("TopicDetail should not render the word bank as a detached block below the lesson body.");
}

if (topicDetail.includes("<InteractiveQuickCheck")) {
  throw new Error("TopicDetail should not render the quick check as a detached block below the lesson body.");
}

if (!lessonRenderer.includes("block.type === 'wordbank_widget'")) {
  throw new Error("LessonContentRenderer must render inline word bank widgets.");
}

if (!lessonRenderer.includes("block.type === 'quickcheck_widget'")) {
  throw new Error("LessonContentRenderer must render inline quick check widgets.");
}

if (!lessonRenderer.includes("block.type === 'ordering_widget'")) {
  throw new Error("LessonContentRenderer must render inline ordering widgets.");
}

console.log("inline-lesson-widget-regression.test.mjs passed");
