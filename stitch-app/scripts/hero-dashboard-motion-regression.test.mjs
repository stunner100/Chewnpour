import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const landing = read('src/pages/LandingPage.jsx');
const stage = read('src/components/landing/HeroDashboardStage.jsx');
const preview = read('src/components/landing/LandingProductPreviews.jsx');

assert.match(landing, /HeroDashboardStage/);
assert.match(landing, /<LandingDashboardPreview \/>/);
assert.match(landing, /heroDashboardFloat/);
assert.match(landing, /heroDashboardShimmer/);
assert.match(landing, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(landing, /\/screenshots\/app-dashboard/);

assert.match(stage, /useSpring/);
assert.match(stage, /useMotionValue/);
assert.match(stage, /useTransform/);
assert.match(stage, /useReducedMotion/);
assert.match(stage, /useInView/);
assert.match(stage, /useScroll/);
assert.match(stage, /min-width: 1024px/);
assert.match(stage, /pointer: fine/);
assert.match(stage, /rotateY\.set/);
assert.match(stage, /hoverScale\.set\(1\.012\)/);
assert.match(stage, /scale: 0\.96/);
assert.doesNotMatch(stage, /LandingDashboardPreview/);

assert.match(preview, /export const LandingDashboardPreview/);
assert.match(preview, /Study home/);
assert.match(preview, /pointer-events-none/);

console.log('hero-dashboard-motion-regression.test.mjs passed');
