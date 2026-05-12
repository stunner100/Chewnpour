import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const appSource = await read('src/App.jsx');
const settingsSource = await read('src/pages/AccountStudySettings.jsx');
const progressSource = await read('src/pages/StudyProgressMastery.jsx');
const progressSnapshotSource = await read('src/components/dashboard/ProgressSnapshot.jsx');
const courseSidebarSource = await read('src/components/course/CourseProgressSidebar.jsx');
const dashboardCourseSource = await read('src/pages/DashboardCourse.jsx');

for (const snippet of [
  '<Route path="/dashboard/search" element={<Navigate to="/dashboard/library" replace />} />',
  '<Route path="/dashboard/exam" element={<Navigate to="/dashboard/quiz" replace />} />',
  '<Route path="/dashboard/analysis" element={<Navigate to="/dashboard/progress" replace />} />',
  '<Route path="/subscription" element={<Navigate to="/dashboard/settings#subscription" replace />} />',
  '<Route path="/profile" element={<Navigate to="/dashboard/settings#profile" replace />} />',
  '<Route path="/profile/edit" element={<Navigate to="/dashboard/settings#profile" replace />} />',
]) {
  if (!appSource.includes(snippet)) {
    throw new Error(`Expected old route cutover redirect: ${snippet}`);
  }
}

for (const forbiddenSnippet of [
  "const DashboardAnalysisPage = lazyRoute",
  "const DashboardSearch = lazyRoute",
  "const DashboardFullAnalysis = lazyRoute",
  "const PastQuestionsComingSoon = lazyRoute",
  "const Profile = lazyRoute",
  "const EditProfile = lazyRoute",
  "const Subscription = lazyRoute",
  "Legacy dashboard routes preserved for backward compatibility",
]) {
  if (appSource.includes(forbiddenSnippet)) {
    throw new Error(`Old route/component should not be wired into App.jsx: ${forbiddenSnippet}`);
  }
}

for (const [source, label] of [
  [settingsSource, 'AccountStudySettings.jsx'],
  [progressSource, 'StudyProgressMastery.jsx'],
  [progressSnapshotSource, 'ProgressSnapshot.jsx'],
  [courseSidebarSource, 'CourseProgressSidebar.jsx'],
  [dashboardCourseSource, 'DashboardCourse.jsx'],
]) {
  if (source.includes('to="/dashboard/analysis"') || source.includes('to="/dashboard/search"') || source.includes('to="/subscription"')) {
    throw new Error(`${label} should not link users into old dashboard screens.`);
  }
}

console.log('old-dashboard-route-cutover-regression.test.mjs passed');
