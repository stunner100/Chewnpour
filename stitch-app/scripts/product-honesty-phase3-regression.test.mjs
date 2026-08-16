/**
 * Regression: Phase 3 product honesty (live study loop only; parked features disclosed).
 * Run: node scripts/product-honesty-phase3-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const dashboard = read('src/pages/StudentDashboard.jsx');
const hero = read('src/components/dashboard/DashboardHero.jsx');
const landing = read('src/pages/LandingPage.jsx');
const parkedView = read('src/components/ParkedFeatureView.jsx');
const kids = read('src/pages/Kids.jsx');
const podcasts = read('src/pages/DashboardPodcasts.jsx');
const sharePage = read('src/pages/PublicSharedCourse.jsx');
const app = read('src/App.jsx');
const upload = read('src/pages/UploadMaterials.jsx');
const subscription = read('src/pages/Subscription.jsx');

assert.doesNotMatch(dashboard, /Supabase/i, 'dashboard must not show migration/Supabase copy');
assert.match(dashboard, /Continue learning/, 'dashboard must offer continue learning');
assert.match(dashboard, /\/api\/courses/, 'dashboard must load live courses');
assert.match(dashboard, /\/api\/uploads/, 'dashboard must load live uploads');

assert.doesNotMatch(hero, /flashcards,\s*podcasts/i, 'hero must not promise flashcards+podcasts');
assert.doesNotMatch(hero, /'Flashcards'/, 'hero marquee must not advertise Flashcards');
assert.doesNotMatch(hero, /'Podcasts'/, 'hero marquee must not advertise Podcasts');
assert.doesNotMatch(hero, /'Exam Prep'/, 'hero marquee must not advertise Exam Prep');

assert.doesNotMatch(landing, /Turn Slides into a Podcast/, 'landing must not sell podcasts as a marketing gimmick');
assert.doesNotMatch(landing, /generates podcasts/i, 'landing blog must not sell podcast generation');
assert.match(landing, /track what stuck/, 'landing should promote live progress tracking');

assert.doesNotMatch(upload, /flashcards/i, 'upload copy must not promise flashcards');
assert.doesNotMatch(subscription, /podcasts/i, 'subscription FAQ must not promise podcasts');

assert.match(parkedView, /This feature is paused|paused/i, 'parked view must disclose pause');
assert.match(kids, /ParkedFeatureView/, 'kids route page must use honest parked view');
assert.doesNotMatch(podcasts, /ParkedFeatureView/, 'podcasts page must be live, not parked');
assert.doesNotMatch(sharePage, /ParkedFeatureView/, 'public share page must be live, not parked');
assert.match(sharePage, /\/api\/share\//, 'public share page must load generated topics');
assert.match(sharePage, /LessonSectionStepper/, 'public share page must use the live section stepper');
assert.doesNotMatch(sharePage, /\/api\/topics\/.+\/chat/, 'shared course must not include tutor');
assert.match(app, /path="\/c\/:token"/, 'public share route must be live');
assert.doesNotMatch(app, /ParkedDashboardFeature title="Study podcasts"/, 'podcasts route must be live');
assert.match(
  app,
  /path="\/dashboard\/podcasts" element=\{withSuspense\(<ProtectedRoute><DashboardLayout><DashboardPodcasts \/>/,
  'podcasts hub must be a live protected dashboard route',
);
assert.match(app, /ParkedDashboardFeature title="Kids mode"/, 'dashboard kids route must be parked honestly');
assert.match(app, /import AppIcon from ['"].*AppIcon['"]/, 'App.jsx NotFound must import AppIcon');
assert.doesNotMatch(app, /path="\/dashboard\/podcasts" element=\{<Navigate to="\/dashboard"/, 'podcasts must not silently Navigate to dashboard');

console.log('product-honesty-phase3-regression: ok');
