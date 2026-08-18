import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const appPath = path.join(root, 'src', 'App.jsx');

const appSource = await fs.readFile(appPath, 'utf8');

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

if (!/const\s+SignUpPage\s*=\s*lazyRoute\(\(\)\s*=>\s*import\('\.\/pages\/SignUp'\),\s*\{\s*componentName:\s*'SignUp'\s*\}\);/.test(appSource)) {
  throw new Error('Expected SignUpPage lazy route to configure componentName fallback.');
}

for (const removedRoute of [
  'DashboardAnalysisPage',
  'DashboardFullAnalysis',
  'DashboardCourse',
  'ExamMode',
  'DashboardResults',
]) {
  if (appSource.includes(removedRoute)) {
    throw new Error(`Expected old dashboard page ${removedRoute} to be removed from App route wiring.`);
  }
}

if (!/path=\"\/signup\"\s+element=\{withSuspense\(<SignUpPage\s*\/>\)\}/.test(appSource)) {
  throw new Error('Expected /signup route to render SignUpPage.');
}

if (!appSource.includes('<Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>')) {
  throw new Error('Expected dashboard routes to share one ProtectedRoute + DashboardLayout shell.');
}

if (!/path=\"\/dashboard\"\s+element=\{withSuspense\(<StudentDashboard\s*\/>\)\}/.test(appSource)) {
  throw new Error('Expected /dashboard route to render the new StudentDashboard.');
}

if (!appSource.includes('<Route path="/dashboard/analysis" element={<Navigate to="/dashboard/progress" replace />} />')) {
  throw new Error('Expected /dashboard/analysis to redirect to the new progress screen.');
}

if (!/const\s+TopicDetail\s*=\s*lazyRoute\(\(\)\s*=>\s*import\('\.\/pages\/TopicDetail'\),\s*\{\s*componentName:\s*'TopicDetail',\s*namedExport:\s*'TopicDetail'\s*\}\);/.test(appSource)) {
  throw new Error('Expected TopicDetail lazy route to configure componentName and namedExport fallback.');
}

console.log('lazy-route-export-resilience-regression.test.mjs passed');
