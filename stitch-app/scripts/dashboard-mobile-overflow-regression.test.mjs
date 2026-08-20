import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [dashboardSource, layoutSource, sidebarSource, quizSource] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/components/DashboardLayout.jsx'),
  read('src/components/ui/sidebar.jsx'),
  read('src/pages/ActiveQuizSession.jsx'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} is missing: ${snippet}`);
  }
};

requireIncludes(
  sidebarSource,
  '"relative flex w-full min-w-0 max-w-full flex-1 flex-col bg-background',
  'SidebarInset must shrink below intrinsic content width on mobile',
);
requireIncludes(
  sidebarSource,
  'max-w-full min-w-0 overflow-x-hidden',
  'Dashboard shell must not grow past the phone viewport',
);
requireIncludes(
  layoutSource,
  'className="min-w-0 w-full max-w-full"',
  'Dashboard BlurFade wrapper must not force the page wider than the viewport',
);
requireIncludes(
  layoutSource,
  'overflow-x-hidden overflow-y-auto',
  'Dashboard main must clip horizontal overflow instead of widening the page',
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
requireIncludes(
  dashboardSource,
  'flex min-h-12 min-w-0 items-center gap-2 rounded-2xl bg-surface-soft',
  'Quick action tiles must shrink instead of overflowing the card',
);
requireIncludes(
  dashboardSource,
  '<span className="min-w-0 truncate">{action.label}</span>',
  'Quick action labels must truncate instead of stretching the grid',
);
requireIncludes(
  dashboardSource,
  'Active recall beats re-reading. Five minutes now surfaces what still needs work.',
  'Recommended copy must remain in the Quick actions card',
);
if (!dashboardSource.includes('[overflow-wrap:anywhere]')) {
  throw new Error('Recommended copy must wrap instead of clipping at the card edge');
}

requireIncludes(
  quizSource,
  'min-h-[calc(100dvh-4rem)] min-w-0 max-w-full overflow-x-hidden bg-background-light',
  'Quiz hub page must shrink and clip instead of widening the phone viewport',
);
requireIncludes(
  quizSource,
  'grid min-w-0 gap-4 md:grid-cols-2',
  'Quiz hub grid must allow shrinking so long topic titles do not overflow',
);
requireIncludes(
  quizSource,
  'flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-[24px]',
  'Practice quizzes card must clip to the column instead of expanding it',
);
requireIncludes(
  quizSource,
  'className="flex min-w-0 items-center justify-between gap-3 rounded-xl',
  'Quiz topic rows must shrink so the card stays inside the viewport',
);
requireIncludes(
  quizSource,
  '<span className="min-w-0 truncate" title={topic.title}>{topic.title}</span>',
  'Quiz topic titles must truncate instead of stretching the card',
);

console.log('dashboard-mobile-overflow-regression.test.mjs passed');
