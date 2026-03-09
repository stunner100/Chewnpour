import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const dashboardLayoutSource = await fs.readFile(
  path.join(root, "src/components/DashboardLayout.jsx"),
  "utf8",
);
const topicDetailSource = await fs.readFile(
  path.join(root, "src/pages/TopicDetail.jsx"),
  "utf8",
);

for (const pattern of [
  "const hideMobileBottomNav = location.pathname.startsWith('/dashboard/exam');",
]) {
  if (!dashboardLayoutSource.includes(pattern)) {
    throw new Error(`Expected DashboardLayout to include \"${pattern}\".`);
  }
}

for (const pattern of [
  "className=\"hidden md:flex items-center gap-2 overflow-x-auto pb-1 -mb-1\"",
  "className=\"mb-4 hidden md:block\"",
  "Voice playback is temporarily unavailable on mobile.",
]) {
  if (!topicDetailSource.includes(pattern)) {
    throw new Error(`Expected TopicDetail mobile voice lockout to include \"${pattern}\".`);
  }
}

console.log("topic-detail-mobile-voice-controls-hidden-regression.test.mjs passed");
