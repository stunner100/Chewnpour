import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const source = await fs.readFile(path.join(root, "src/pages/TopicDetail.jsx"), "utf8");

if (!source.includes("import StudyModeSelector from '../components/StudyModeSelector';")) {
  throw new Error("TopicDetail must import the study mode selector.");
}

if (!source.includes("setStudyMode(null);")) {
  throw new Error("TopicDetail must reset the study mode chooser when the route topic changes.");
}

if (source.includes("sessionStorage.getItem(`studyMode:${routeTopicId}`)")) {
  throw new Error("TopicDetail must not persist study mode selection across topic re-entry.");
}

if (!source.includes("<StudyModeSelector")) {
  throw new Error("TopicDetail must render the study mode selector before lesson content.");
}

console.log("topic-study-mode-selector-regression.test.mjs passed");
