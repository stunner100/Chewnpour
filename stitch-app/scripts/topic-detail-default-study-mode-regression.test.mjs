import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const topicDetailPath = path.join(root, "src", "pages", "TopicDetail.jsx");
const topicDetailSource = await fs.readFile(topicDetailPath, "utf8");

if (!topicDetailSource.includes("const [studyMode, setStudyMode] = useState('full');")) {
  throw new Error("TopicDetail must default study mode to full so lesson routes stay interactive.");
}

if (!topicDetailSource.includes("setStudyMode(storedMode || 'full');")) {
  throw new Error("TopicDetail must recover stored study mode per topic while defaulting to full.");
}

if (topicDetailSource.includes("if (normalizedContent && !studyMode) {")) {
  throw new Error("TopicDetail should not block the lesson behind the study mode selector.");
}

console.log("topic-detail-default-study-mode-regression.test.mjs passed");
