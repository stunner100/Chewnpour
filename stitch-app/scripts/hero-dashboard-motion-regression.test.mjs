import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const landing = read('src/pages/LandingPage.jsx');
const stage = read('src/components/landing/HeroDashboardStage.jsx');
const preview = read('src/components/landing/LandingProductPreviews.jsx');
const demo = read('src/components/landing/HeroProductDemo.jsx');
const hook = read('src/components/landing/useHeroProductDemo.js');
const script = read('src/components/landing/heroProductDemoScript.js');

assert.match(landing, /HeroDashboardStage/);
assert.match(landing, /<LandingDashboardPreview \/>/);
assert.match(landing, /heroDashboardFloat/);
assert.match(landing, /hero-demo-dot/);
assert.match(landing, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(landing, /\/screenshots\/app-dashboard/);
assert.doesNotMatch(landing, /heroDashboardShimmer/);

assert.match(stage, /useReducedMotion/);
assert.match(stage, /useInView/);
assert.match(stage, /scale: 0\.98/);
assert.doesNotMatch(stage, /rotateY/);
assert.doesNotMatch(stage, /hero-dashboard-shimmer/);
assert.doesNotMatch(stage, /LandingDashboardPreview/);

assert.match(preview, /export const LandingDashboardPreview/);
assert.match(preview, /HeroProductDemo/);

assert.match(demo, /useHeroProductDemo/);
assert.match(demo, /prefers-reduced-motion|useReducedMotion/);
assert.match(demo, /Generate lesson/);
assert.doesNotMatch(demo, /\bfetch\s*\(/);
assert.doesNotMatch(hook, /\bfetch\s*\(/);
assert.doesNotMatch(script, /\bfetch\s*\(/);

assert.match(script, /Can you explain working memory in simple terms\?/);
assert.match(script, /Working memory is your brain's temporary workspace/);
assert.match(script, /DEMO_TIMING/);

console.log('hero-dashboard-motion-regression.test.mjs passed');
