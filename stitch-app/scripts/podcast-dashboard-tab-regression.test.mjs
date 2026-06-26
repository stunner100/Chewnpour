import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [appSource, dashboardLayoutSource, appSidebarSource, mobileBottomNavSource, commandPaletteSource] = await Promise.all([
  read('src/App.jsx'),
  read('src/components/DashboardLayout.jsx'),
  read('src/components/app-sidebar.jsx'),
  read('src/components/MobileBottomNav.jsx'),
  read('src/components/CommandPalette.jsx'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`${label} should not include "${snippet}".`);
  }
};

requireIncludes(appSource, "const DashboardPodcasts = lazyRoute(() => import('./pages/DashboardPodcasts')", 'App.jsx');
requireIncludes(
  appSource,
  '<Route path="/dashboard/podcasts" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardPodcasts /></DashboardLayout></ProtectedRoute>)} />',
  'App.jsx',
);
requireExcludes(appSource, '<Route path="/dashboard/podcasts" element={<Navigate', 'App.jsx');

requireIncludes(
  appSidebarSource,
  "{ title: 'Podcasts', url: '/dashboard/podcasts', icon: PodcastIcon }",
  'app-sidebar.jsx',
);
requireIncludes(
  mobileBottomNavSource,
  "'/dashboard/podcasts'",
  'MobileBottomNav.jsx',
);
requireIncludes(
  mobileBottomNavSource,
  "Podcasts",
  'MobileBottomNav.jsx',
);
requireIncludes(
  commandPaletteSource,
  "{ label: 'Podcasts', value: '/dashboard/podcasts', icon: 'podcasts'",
  'CommandPalette.jsx',
);

console.log('podcast-dashboard-tab-regression.test.mjs passed');
