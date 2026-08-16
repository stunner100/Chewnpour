import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const topicDetail = await fs.readFile(path.join(root, "src/pages/TopicDetail.jsx"), "utf8");
const topicHook = await fs.readFile(path.join(root, "src/hooks/useTopicDetail.js"), "utf8");
const contentPanel = await fs.readFile(path.join(root, "src/components/topic/TopicContentPanel.jsx"), "utf8");
const lessonSections = await fs.readFile(path.join(root, "src/lib/lessonSections.js"), "utf8");
const lessonRenderer = await fs.readFile(path.join(root, "src/components/LessonContentRenderer.jsx"), "utf8");
const stepper = await fs.readFile(path.join(root, "src/components/lesson/LessonSectionStepper.jsx"), "utf8");

if (!contentPanel.includes("LessonSectionStepper")) {
  throw new Error("TopicContentPanel must mount the section stepper as the live lesson reader.");
}

if (!topicHook.includes("buildLessonSteps")) {
  throw new Error("useTopicDetail must build lesson steps for the stepper.");
}

if (!lessonSections.includes("type: \"wordbank_widget\"" ) && !lessonSections.includes("type: 'wordbank_widget'")) {
  throw new Error("lessonSections must keep Word Bank as its own stepper step.");
}

if (!stepper.includes("wordbank_widget") && !stepper.includes("InteractiveWordBank") && !lessonRenderer.includes("block.type === 'wordbank_widget'")) {
  throw new Error("Word Bank must still render inside the stepper.");
}

if (topicHook.includes("type: 'quickcheck_widget'")) {
  throw new Error("useTopicDetail must not inject reveal-card quick check widgets.");
}

if (topicHook.includes("type: 'ordering_widget'")) {
  throw new Error("useTopicDetail must not inject an ordering widget into the scrolling article.");
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

if (lessonRenderer.includes("block.type === 'quickcheck_widget'")) {
  throw new Error("LessonContentRenderer must not render reveal-card quick checks in the live reader.");
}

if (lessonRenderer.includes("block.type === 'ordering_widget'")) {
  throw new Error("LessonContentRenderer must not render ordering as an article widget.");
}

console.log("inline-lesson-widget-regression.test.mjs passed");
