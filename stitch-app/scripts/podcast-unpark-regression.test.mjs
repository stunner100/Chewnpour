import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const app = read('src/App.jsx');
const hub = read('src/pages/DashboardPodcasts.jsx');
const card = read('src/components/lesson/LessonPodcastCard.jsx');
const panel = read('src/components/topic/TopicContentPanel.jsx');
const hook = read('src/hooks/useTopicDetail.js');
const server = read('server/podcasts.js');
const http = read('server/podcastHttp.js');
const generateApi = read('api/podcast-generate.js');
const router = read('api/router.js');
const vercel = read('vercel.json');
const migration = read('supabase/migrations/20260813160000_topic_podcasts.sql');
const sidebar = read('src/components/app-sidebar.jsx');
const mobileNav = read('src/components/MobileBottomNav.jsx');
const commandPalette = read('src/components/CommandPalette.jsx');

assert.match(
  app,
  /lazyRoute\(\(\) => import\('\.\/pages\/DashboardPodcasts'\)/,
  'App must lazy-load DashboardPodcasts',
);
assert.match(
  app,
  /path="\/dashboard\/podcasts" element=\{withSuspense\(<ProtectedRoute><DashboardLayout><DashboardPodcasts \/>/,
  'Podcasts hub must be a live protected dashboard route',
);
assert.doesNotMatch(
  app,
  /ParkedDashboardFeature title="Study podcasts"/,
  'Podcasts must not stay behind ParkedDashboardFeature',
);

assert.match(hub, /\/api\/podcasts/, 'Podcasts hub must list live podcasts');
assert.match(hub, /\/api\/podcast-generate/, 'Podcasts hub must POST to the dedicated generate function');
assert.match(hub, /PodcastWaveformPlayer/, 'Podcasts hub must play audio with the waveform player');
assert.doesNotMatch(hub, /ParkedFeatureView/, 'DashboardPodcasts must not render the parked stub');
assert.doesNotMatch(hub, /from ['"]convex\//i, 'DashboardPodcasts must stay Convex-free');

assert.match(card, /\/api\/podcasts\?topicId=/, 'Lesson card must load the topic podcast');
assert.match(card, /\/api\/podcast-generate/, 'Lesson card must generate through the dedicated function');
assert.match(panel, /LessonPodcastCard/, 'Lesson page must mount the podcast card');
assert.match(hook, /const podcastEnabled = true/, 'Lesson hook must enable the podcast surface');

assert.match(server, /export const generatePodcastForTopic/, 'Server must generate topic podcasts');
assert.match(server, /HOST|GUEST/, 'Server must write a two-host script');
assert.match(server, /aura-2-apollo-en/, 'Host voice must default to Apollo');
assert.match(server, /aura-2-luna-en/, 'Guest voice must default to Luna');
assert.match(server, /callDeepgramSpeak/, 'Server must synthesize with Deepgram only');
assert.match(server, /uploadObject/, 'Server must store MP3s in Supabase Storage');
assert.doesNotMatch(server, /mimo|xiaomimimo|PODCAST_GEN_ENABLED/i, 'Live podcasts must not keep MiMo or Convex feature flags');

assert.match(http, /listPodcastsForUser/, 'GET /api/podcasts must list the user library');
assert.match(generateApi, /generatePodcastForTopic/, 'Dedicated generate function must call the server generator');
assert.match(generateApi, /maxDuration:\s*120/, 'Generate function must allow up to 120s');
assert.match(router, /handlePodcastsRequest/, 'Router must serve GET /api/podcasts');
assert.doesNotMatch(router, /podcast-generate/, 'Generate must not go through the anydoc router');
assert.match(vercel, /"source": "\/api\/podcast-generate"/, 'Vercel must bypass the catch-all router for generate');
assert.match(vercel, /"api\/podcast-generate\.js"/, 'Vercel must isolate podcast-generate as its own function');

assert.match(migration, /CREATE TABLE IF NOT EXISTS "topic_podcasts"/, 'Postgres must persist topic_podcasts');
assert.match(sidebar, /url: '\/dashboard\/podcasts'/, 'Sidebar must include Podcasts');
assert.match(mobileNav, /path: '\/dashboard\/podcasts'/, 'Mobile more menu must include Podcasts');
assert.match(commandPalette, /value: '\/dashboard\/podcasts'/, 'Command palette must include Podcasts');

console.log('podcast-unpark-regression.test.mjs passed');
