import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const appPath = path.join(root, 'src', 'App.jsx');
const dashboardCoursePath = path.join(root, 'src', 'pages', 'DashboardCourse.jsx');

const [appSource, dashboardCourseSource] = await Promise.all([
  fs.readFile(appPath, 'utf8'),
  fs.readFile(dashboardCoursePath, 'utf8'),
]);

for (const pattern of [
  'const resolveLazyRouteModule =',
  'const exportCandidates = []',
  'for (const candidate of [namedExport, componentName])',
  'const functionExports = Object.entries(mod)',
  'attemptChunkRecoveryReload(routeName)',
  '<ChunkRecoveryFallback',
  'componentName={routeName}',
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected src/App.jsx to include "${pattern}" for resilient lazy route export handling.`);
  }
}

if (!/const\s+DashboardCourse\s*=\s*lazyRoute\(\(\)\s*=>\s*import\('\.\/pages\/DashboardCourse'\),\s*\{[\s\S]*namedExport:\s*'DashboardCourse'[\s\S]*\}\);/m.test(appSource)) {
  throw new Error('Expected DashboardCourse lazy route to configure named export fallback.');
}

if (!/const\s+SignUpPage\s*=\s*lazyRoute\(\(\)\s*=>\s*import\('\.\/pages\/SignUp'\),\s*\{\s*componentName:\s*'SignUp'\s*\}\);/.test(appSource)) {
  throw new Error('Expected SignUpPage lazy route to configure componentName fallback.');
}

if (/DashboardAnalysisPage/.test(appSource) || /DashboardFullAnalysis/.test(appSource)) {
  throw new Error('Expected old analysis pages to be removed from App route wiring.');
}

if (!/path=\"\/signup\"\s+element=\{withSuspense\(<SignUpPage\s*\/>\)\}/.test(appSource)) {
  throw new Error('Expected /signup route to render SignUpPage.');
}

if (!/path=\"\/dashboard\"\s+element=\{withSuspense\(<ProtectedRoute><DashboardLayout><StudentDashboard\s*\/><\/DashboardLayout><\/ProtectedRoute>\)\}/.test(appSource)) {
  throw new Error('Expected /dashboard route to render the new StudentDashboard.');
}

if (!appSource.includes('<Route path="/dashboard/analysis" element={<Navigate to="/dashboard/progress" replace />} />')) {
  throw new Error('Expected /dashboard/analysis to redirect to the new progress screen.');
}

if (!/export\s*\{\s*DashboardCourse\s*\};/.test(dashboardCourseSource)) {
  throw new Error('Expected DashboardCourse page to export a named DashboardCourse symbol.');
}

if (!/export\s+default\s+DashboardCourse;/.test(dashboardCourseSource)) {
  throw new Error('Expected DashboardCourse page to keep a default export.');
}

console.log('lazy-route-export-resilience-regression.test.mjs passed');
