import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const landing = read('src/pages/LandingPage.jsx');
const preview = read('src/components/landing/LandingProductPreviews.jsx');
const dashboard = read('src/pages/StudentDashboard.jsx');
const sidebar = read('src/components/app-sidebar.jsx');

assert.match(landing, /LandingDashboardPreview/);
assert.match(landing, /LandingLessonPreview/);
assert.doesNotMatch(landing, /\/redesign\/product-mockup/);

for (const label of ['Dashboard', 'Upload', 'My Materials', 'Lessons', 'Quizzes', 'AI Tutor', 'Progress']) {
  assert.match(preview, new RegExp(label), `Preview sidebar should include ${label}`);
  assert.match(sidebar, new RegExp(label), `Real sidebar should include ${label}`);
}

assert.match(preview, /Generate Material/);
assert.match(sidebar, /Generate Material/);
assert.match(preview, /Study home/);
assert.match(dashboard, /Study home/);
assert.match(preview, /Continue learning/);
assert.match(dashboard, /Continue learning/);
assert.match(preview, /Recent materials/);
assert.match(dashboard, /Recent materials/);
assert.match(preview, /Search materials, lessons, or topics/);
assert.match(preview, /Start quiz/);
assert.match(preview, /Test this lesson/);
assert.match(preview, /pointer-events-none/);

console.log('landing-dashboard-preview-regression.test.mjs passed');
