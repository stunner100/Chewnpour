import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  access,
  metrics,
  http,
  router,
  app,
  dashboard,
  overview,
  constants,
  commandPalette,
] = await Promise.all([
  read('server/adminAccess.js'),
  read('server/adminMetrics.js'),
  read('server/adminHttp.js'),
  read('api/router.js'),
  read('src/App.jsx'),
  read('src/pages/admin/AdminDashboard.jsx'),
  read('src/pages/admin/panels/OverviewPanel.jsx'),
  read('src/lib/admin/constants.js'),
  read('src/components/CommandPalette.jsx'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(snippet)}`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Did not expect ${label} to include ${JSON.stringify(snippet)}`);
  }
};

requireIncludes(access, 'const BOOTSTRAP_ADMIN_EMAILS = ["patrickannor35@gmail.com"];', 'admin allowlist');
requireExcludes(access, 'info@chewnpour.com', 'bootstrap email');
requireIncludes(http, 'isAdminUser', 'admin HTTP auth');
requireIncludes(http, 'getAdminSnapshot', 'admin snapshot route');
requireIncludes(http, '/api/admin/snapshot', 'snapshot path');
requireIncludes(router, 'handleAdminRequest', 'API router');
requireIncludes(router, 'pathname.startsWith("/api/admin/")', 'admin router prefix');
requireIncludes(app, "const AdminDashboard = lazyRoute(() => import('./pages/admin/AdminDashboard')", 'admin lazy route');
requireIncludes(
  app,
  '<Route path="/admin" element={withSuspense(<ProtectedRoute><DashboardLayout><AdminDashboard /></DashboardLayout></ProtectedRoute>)} />',
  'live /admin route',
);
requireExcludes(app, 'ParkedDashboardFeature title="Admin dashboard"', 'parked admin');
requireIncludes(dashboard, './panels/OverviewPanel', 'admin shell overview');
requireIncludes(dashboard, './panels/ContentPanel', 'admin shell content');
requireIncludes(dashboard, 'Bootstrap admin includes', 'bootstrap hint');
requireIncludes(dashboard, 'patrickannor35@gmail.com', 'bootstrap email in UI payload path');
requireIncludes(overview, 'Tutor sessions', 'overview usage copy');
requireExcludes(constants, 'Revenue', 'retired revenue tab');
requireExcludes(constants, 'PAYMENT_PROVIDER_FALLBACK_OPTIONS', 'retired payment settings');
requireExcludes(metrics, 'extracted_text', 'upload text leak');
requireExcludes(metrics, 'FROM session', 'session table scan');
requireExcludes(metrics, 'FROM "session"', 'quoted session scan');
requireIncludes(metrics, 'LIMIT $1', 'bounded recent lists');
requireExcludes(metrics, 'credit_ledger', 'billing leftover');
requireExcludes(metrics, 'payments', 'payments leftover');
requireExcludes(dashboard, 'from \'convex/react\'', 'convex-free admin UI');
requireIncludes(commandPalette, '/api/admin', 'command palette admin probe');
requireIncludes(commandPalette, "value: '/admin'", 'command palette admin dest');

for (const relativePath of [
  'src/pages/admin/AdminDashboard.jsx',
  'src/pages/admin/panels/OverviewPanel.jsx',
  'src/pages/admin/panels/LearningPanel.jsx',
  'src/pages/admin/panels/ContentPanel.jsx',
  'src/pages/admin/panels/UsersPanel.jsx',
  'src/pages/admin/panels/UploadsPanel.jsx',
]) {
  const source = await read(relativePath);
  if (/from ['"]convex\/react['"]|useQuery|useMutation/.test(source)) {
    throw new Error(`${relativePath} must stay Convex-free.`);
  }
}

console.log('supabase-admin-dashboard-regression.test.mjs passed');
