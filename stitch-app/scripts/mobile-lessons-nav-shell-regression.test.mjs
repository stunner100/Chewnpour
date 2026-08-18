import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const app = read('src/App.jsx');
const layout = read('src/components/DashboardLayout.jsx');
const uploads = read('src/hooks/useHasUploads.js');
const nav = read('src/components/MobileBottomNav.jsx');

assert.match(
  app,
  /<Route element=\{<ProtectedRoute><DashboardLayout \/><\/ProtectedRoute>\}>/,
  'Dashboard pages must share one layout shell so the mobile tab bar does not remount.',
);
assert.match(
  app,
  /path="\/dashboard\/lessons" element=\{withSuspense\(<LessonMemoryNeuralBasis \/>\)\}/,
  'Lessons must render inside the shared dashboard shell.',
);
assert.doesNotMatch(
  app,
  /path="\/dashboard\/lessons" element=\{withSuspense\(<ProtectedRoute><DashboardLayout>/,
  'Lessons must not mount a fresh DashboardLayout on every tap.',
);
assert.match(
  layout,
  /children \?\? <Outlet \/>/,
  'DashboardLayout must keep an Outlet for nested dashboard pages.',
);
assert.match(
  uploads,
  /let cachedHasUploads = false/,
  'Upload presence must survive tab remounts so returning tabs do not flash first-run items.',
);
assert.match(
  uploads,
  /useState\(cachedHasUploads\)/,
  'hasUploads first paint must reuse the cached returning-user tabs.',
);
assert.match(
  nav,
  /path: '\/dashboard\/lessons'/,
  'Lessons must stay a primary mobile tab.',
);

console.log('mobile-lessons-nav-shell-regression.test.mjs passed');
