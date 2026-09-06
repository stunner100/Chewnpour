import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const landing = read('src/pages/LandingPage.jsx');
const preview = read('src/components/landing/LandingProductPreviews.jsx');
const chrome = read('src/components/landing/landingProductChrome.jsx');
const dashboard = read('src/pages/StudentDashboard.jsx');
const sidebar = read('src/components/app-sidebar.jsx');
const productUi = `${preview}\n${chrome}`;

assert.match(landing, /LandingDashboardPreview/);
assert.match(landing, /LandingLessonPreview/);
assert.doesNotMatch(landing, /\/redesign\/product-mockup/);

for (const label of ['Dashboard', 'Upload', 'My Materials', 'Lessons', 'Quizzes', 'AI Tutor', 'Progress']) {
  assert.match(productUi, new RegExp(label), `Preview sidebar should include ${label}`);
  assert.match(sidebar, new RegExp(label), `Real sidebar should include ${label}`);
}

assert.match(productUi, /Generate Material/);
assert.match(sidebar, /Generate Material/);
assert.match(productUi, /Study home/);
assert.match(dashboard, /Study home/);
assert.match(productUi, /Continue learning/);
assert.match(dashboard, /Continue learning/);
assert.match(productUi, /Recent materials/);
assert.match(dashboard, /Recent materials/);
assert.match(productUi, /Search materials, lessons, or topics/);
assert.match(productUi, /Start quiz/);
assert.match(productUi, /Test this lesson/);
assert.match(productUi, /pointer-events-none/);

console.log('landing-dashboard-preview-regression.test.mjs passed');
