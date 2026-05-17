import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/StudentDashboard.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`StudentDashboard.jsx should include ${label}.`);
  }
};

requireIncludes(
  "import { useConvexAuth, useQuery } from 'convex/react';",
  'Convex auth state import',
);
requireIncludes(
  'const shouldLoadDashboardData = isAuthenticated && !authLoading;',
  'dashboard query auth gate',
);

[
  'api.profiles.getUserStats',
  'api.courses.getUserCourses',
  'api.uploads.getUserUploads',
  'api.topics.getResumeTarget',
  'api.concepts.getConceptReviewQueue',
].forEach((queryName) => {
  if (!source.includes(`useQuery(${queryName}, shouldLoadDashboardData ?`)) {
    throw new Error(`${queryName} should be skipped until Convex auth is ready.`);
  }
});

requireIncludes('const formatActivityLabel = (title, index) => {', 'readable chart label formatter');
requireIncludes(
  "label: formatActivityLabel(formatDashboardTitle(course.title, ''), index),",
  'formatted and sanitized chart label usage',
);

if (source.includes("course.title.slice(0, 3)")) {
  throw new Error('Course Progress should not truncate course labels to three characters.');
}

requireIncludes('const isDashboardProbeTitle = (title = \'\') => {', 'internal probe title detector');
requireIncludes('(?:^|[-_\\s])qa(?:$|[-_\\s])', 'explicit QA slug detector');
requireIncludes('const displayResumeTitle =', 'sanitized resume title');

if (source.includes("{resumeCourse?.title || 'No course selected'}")) {
  throw new Error('Resume card should not render raw course titles that can expose probe/test content.');
}

console.log('dashboard-page-qa-regression.test.mjs passed');
