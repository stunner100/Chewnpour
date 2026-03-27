import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const dashboardCourseSource = await fs.readFile(
  path.join(root, "src/pages/DashboardCourse.jsx"),
  "utf8"
);

const expectations = [
  "const resetCourseScrollPosition = React.useCallback(() => {",
  "const main = document.getElementById('dashboard-main');",
  "main.scrollTo({ top: 0, left: 0, behavior: 'auto' });",
  "window.requestAnimationFrame(() => {",
  "React.useLayoutEffect(() => {",
];

for (const snippet of expectations) {
  if (!dashboardCourseSource.includes(snippet)) {
    throw new Error(`DashboardCourse is missing expected scroll-reset snippet: ${snippet}`);
  }
}

console.log("dashboard-course-scroll-reset-regression.test.mjs passed");
