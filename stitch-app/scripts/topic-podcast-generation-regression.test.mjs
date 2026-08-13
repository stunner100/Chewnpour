import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  serverSource,
  generateApiSource,
  httpSource,
  routerSource,
  vercelSource,
  migrationSource,
  panelSource,
  contentPanelSource,
  cardSource,
  hubSource,
] = await Promise.all([
  read('server/podcasts.js'),
  read('api/podcast-generate.js'),
  read('server/podcastHttp.js'),
  read('api/router.js'),
  read('vercel.json'),
  read('supabase/migrations/20260813160000_topic_podcasts.sql'),
  read('src/components/TopicPodcastPanel.jsx'),
  read('src/components/topic/TopicContentPanel.jsx'),
  read('src/components/lesson/LessonPodcastCard.jsx'),
  read('src/pages/DashboardPodcasts.jsx'),
]);

if (!/CREATE TABLE IF NOT EXISTS "topic_podcasts"/.test(migrationSource)) {
  throw new Error('Expected topic_podcasts Postgres table for live podcasts.');
}
if (!/ENABLE ROW LEVEL SECURITY/.test(migrationSource)) {
  throw new Error('Expected topic_podcasts to enable RLS.');
}

if (!/export const generatePodcastForTopic/.test(serverSource)) {
  throw new Error('Expected server/podcasts.js to expose generatePodcastForTopic.');
}
if (!/parseDialogueTurns/.test(serverSource)) {
  throw new Error('Expected server/podcasts.js to parse HOST and GUEST dialogue turns.');
}
if (!/aura-2-apollo-en/.test(serverSource) || !/aura-2-luna-en/.test(serverSource)) {
  throw new Error('Expected Deepgram host/guest voices Apollo and Luna.');
}
if (!/callDeepgramSpeak/.test(serverSource)) {
  throw new Error('Expected podcast TTS to use Deepgram speak.');
}
if (!/uploadObject/.test(serverSource) || !/createSignedDownloadUrl/.test(serverSource)) {
  throw new Error('Expected podcast audio to persist in Supabase Storage.');
}
if (/xiaomimimo|mimo-v2\.5-tts|PODCAST_GEN_ENABLED/.test(serverSource)) {
  throw new Error('Live podcast generation must not keep MiMo or Convex feature flags.');
}

if (!/generatePodcastForTopic/.test(generateApiSource)) {
  throw new Error('Expected dedicated /api/podcast-generate handler.');
}
if (!/maxDuration:\s*120/.test(generateApiSource)) {
  throw new Error('Expected podcast-generate to allow 120s.');
}
if (!/listPodcastsForUser/.test(httpSource)) {
  throw new Error('Expected GET /api/podcasts to list the user library.');
}
if (!/handlePodcastsRequest/.test(routerSource)) {
  throw new Error('Expected router to serve GET /api/podcasts.');
}
if (/podcast-generate/.test(routerSource)) {
  throw new Error('Expected podcast-generate to stay off the anydoc router.');
}
if (!/"source": "\/api\/podcast-generate"/.test(vercelSource)) {
  throw new Error('Expected Vercel rewrite to isolate /api/podcast-generate.');
}

if (!/LessonPodcastCard/.test(contentPanelSource)) {
  throw new Error('Expected TopicContentPanel to mount LessonPodcastCard.');
}
if (!/\/api\/podcast-generate/.test(cardSource) || !/\/api\/podcasts/.test(cardSource)) {
  throw new Error('Expected LessonPodcastCard to list and generate over HTTP.');
}
if (!/\/api\/podcast-generate/.test(hubSource) || !/PodcastWaveformPlayer/.test(hubSource)) {
  throw new Error('Expected DashboardPodcasts to generate and play live audio.');
}
if (/from ['"]convex\/react['"]|api\.podcasts/.test(panelSource + cardSource + hubSource)) {
  throw new Error('Expected live podcast UI to stay Convex-free.');
}

console.log('topic-podcast-generation-regression.test.mjs passed');
