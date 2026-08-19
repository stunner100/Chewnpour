import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [dashboardSource, layoutSource, sidebarSource] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/components/DashboardLayout.jsx'),
  read('src/components/ui/sidebar.jsx'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} is missing: ${snippet}`);
  }
};

requireIncludes(
  sidebarSource,
  '"relative flex w-full min-w-0 flex-1 flex-col bg-background',
  'SidebarInset must shrink below intrinsic content width on mobile',
);
requireIncludes(
  layoutSource,
  'className="min-w-0 w-full"',
  'Dashboard BlurFade wrapper must not force the page wider than the viewport',
);
requireIncludes(
  dashboardSource,
  'mt-6 grid min-w-0 gap-4 lg:grid-cols-2',
  'Recent materials grid must allow shrinking so long filenames do not overflow',
);
requireIncludes(
  dashboardSource,
  'min-w-0 overflow-hidden rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm',
  'Recent materials card must clip to the column instead of expanding it',
);
requireIncludes(
  dashboardSource,
  'flex min-h-14 min-w-0 items-center justify-between gap-3 py-3',
  'Recent materials rows must shrink so Open stays on-screen',
);
requireIncludes(
  dashboardSource,
  'shrink-0 text-body-sm font-semibold text-primary hover:text-primary-hover',
  'View library must stay visible instead of being clipped off the right edge',
);

console.log('dashboard-mobile-overflow-regression.test.mjs passed');
