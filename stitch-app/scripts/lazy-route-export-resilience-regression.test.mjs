import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const appPath = path.join(root, 'src', 'App.jsx');
const dashboardAnalysisPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const dashboardCoursePath = path.join(root, 'src', 'pages', 'DashboardCourse.jsx');

const [appSource, dashboardAnalysisSource, dashboardCourseSource] = await Promise.all([
  fs.readFile(appPath, 'utf8'),
  fs.readFile(dashboardAnalysisPath, 'utf8'),
  fs.readFile(dashboardCoursePath, 'utf8'),
]);

for (const pattern of [
  'const resolveLazyRouteModule =',
  'const exportCandidates = [namedExport, componentName]',
  'const functionExports = Object.entries(mod)',
  'attemptChunkRecoveryReload(routeName)',
  '<ChunkRecoveryFallback componentName={routeName} />',
]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected src/App.jsx to include "${pattern}" for resilient lazy route export handling.`);
  }
}

if (!/const\s+DashboardCourse\s*=\s*lazyRoute\(\(\)\s*=>\s*import\('\.\/pages\/DashboardCourse'\),\s*\{[\s\S]*namedExport:\s*'DashboardCourse'[\s\S]*\}\);/m.test(appSource)) {
  throw new Error('Expected DashboardCourse lazy route to configure named export fallback.');
}

if (!/import\s+SignUpPage\s+from\s+'\.\/pages\/SignUp';/.test(appSource)) {
  throw new Error('Expected src/App.jsx to statically import SignUp page to avoid lazy export mismatch crashes.');
}

if (!/import\s+DashboardAnalysisPage\s+from\s+'\.\/pages\/DashboardAnalysis';/.test(appSource)) {
  throw new Error('Expected src/App.jsx to statically import DashboardAnalysis page to avoid lazy export mismatch crashes.');
}

if (/const\s+SignUp\s*=\s*lazyRoute\(/.test(appSource)) {
  throw new Error('Expected SignUp to avoid lazyRoute and use static import.');
}

if (/const\s+DashboardAnalysis\s*=\s*lazyRoute\(/.test(appSource)) {
  throw new Error('Expected DashboardAnalysis to avoid lazyRoute and use static import.');
}

if (!/path=\"\/signup\"\s+element=\{withSuspense\(<SignUpPage\s*\/>\)\}/.test(appSource)) {
  throw new Error('Expected /signup route to render statically imported SignUpPage.');
}

if (!/path=\"\/dashboard\"\s+element=\{withSuspense\(<ProtectedRoute><DashboardLayout><DashboardAnalysisPage\s*\/><\/DashboardLayout><\/ProtectedRoute>\)\}/.test(appSource)) {
  throw new Error('Expected /dashboard route to render statically imported DashboardAnalysisPage.');
}

if (!/export\s*\{\s*DashboardAnalysis\s*\};/.test(dashboardAnalysisSource)) {
  throw new Error('Expected DashboardAnalysis page to export a named DashboardAnalysis symbol.');
}

if (!/export\s+default\s+DashboardAnalysis;/.test(dashboardAnalysisSource)) {
  throw new Error('Expected DashboardAnalysis page to keep a default export.');
}

if (!/export\s*\{\s*DashboardCourse\s*\};/.test(dashboardCourseSource)) {
  throw new Error('Expected DashboardCourse page to export a named DashboardCourse symbol.');
}

if (!/export\s+default\s+DashboardCourse;/.test(dashboardCourseSource)) {
  throw new Error('Expected DashboardCourse page to keep a default export.');
}

console.log('lazy-route-export-resilience-regression.test.mjs passed');
