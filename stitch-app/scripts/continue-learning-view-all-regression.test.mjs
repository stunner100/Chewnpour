import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dashboardAnalysisPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const source = await fs.readFile(dashboardAnalysisPath, 'utf8');

if (!/const \[showAllCourses, setShowAllCourses\] = useState\(false\);/.test(source)) {
  throw new Error('Regression detected: Continue Learning no longer tracks expanded course state.');
}

if (!/showAllCourses[\s\S]*\? visibleCourses[\s\S]*: visibleCourses\.slice\(0, 3\)/.test(source)) {
  throw new Error('Regression detected: Continue Learning no longer expands beyond 3 courses.');
}

if (/View all[\s\S]*href="#"/.test(source)) {
  throw new Error('Regression detected: Continue Learning View all still points to a dead anchor.');
}

if (!/setShowAllCourses\(\(current\) => !current\)/.test(source)) {
  throw new Error('Regression detected: Continue Learning View all does not toggle expanded state.');
}

console.log('continue-learning-view-all-regression.test.mjs passed');
