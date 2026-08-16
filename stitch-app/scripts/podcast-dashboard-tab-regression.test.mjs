import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [appSource, appSidebarSource, mobileBottomNavSource, commandPaletteSource] = await Promise.all([
  read('src/App.jsx'),
  read('src/components/app-sidebar.jsx'),
  read('src/components/MobileBottomNav.jsx'),
  read('src/components/CommandPalette.jsx'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

requireIncludes(
  appSource,
  '<Route path="/dashboard/podcasts" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardPodcasts /></DashboardLayout></ProtectedRoute>)} />',
  'App.jsx',
);
requireIncludes(appSource, "import('./pages/DashboardPodcasts')", 'App.jsx');
requireIncludes(appSource, 'DashboardPodcasts', 'App.jsx');

requireIncludes(
  appSidebarSource,
  "/dashboard/podcasts",
  'app-sidebar.jsx',
);
requireIncludes(
  mobileBottomNavSource,
  '/dashboard/podcasts',
  'MobileBottomNav.jsx',
);
requireIncludes(
  commandPaletteSource,
  "/dashboard/podcasts",
  'CommandPalette.jsx',
);

console.log('podcast-dashboard-tab-regression.test.mjs passed');
