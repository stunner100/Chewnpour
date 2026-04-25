import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [chunkRecoverySource, mainSource, convexIdSource, routeResolvedTopicSource, conceptIntroSource, topicDetailSource, examModeSource, conceptBuilderSource] =
  await Promise.all([
    read('src/lib/chunkLoadRecovery.js'),
    read('src/main.jsx'),
    read('src/lib/convexId.js'),
    read('src/hooks/useRouteResolvedTopic.js'),
    read('src/pages/ConceptIntro.jsx'),
    read('src/pages/TopicDetail.jsx'),
    read('src/pages/ExamMode.jsx'),
    read('src/pages/ConceptBuilder.jsx'),
  ]);

const requiredStaleSignatures = [
  'subscriptions:getUploadQuotaStatus',
  'subscriptions:getPublicTopUpPricing',
  'subscriptions:getVoiceGenerationQuotaStatus',
  'topics:getTopicWithQuestions',
  'topics:getUserTopicProgress',
  'topics:getTopicSourcePassages',
  'topicNotes:getNote',
  'topicChat:getMessages',
  'tutor:getTopicTutorSupport',
  'videos:listTopicVideos',
  'podcasts:listTopicPodcasts',
  'concepts:getConceptMasteryForTopic',
];

for (const signature of requiredStaleSignatures) {
  if (!chunkRecoverySource.includes(signature)) {
    throw new Error(`Regression detected: stale Convex signature missing from chunk recovery: ${signature}`);
  }
}

for (const snippet of [
  'const clearLegacyPwaRuntime = () => {',
  'navigator.serviceWorker.getRegistrations()',
  'registration.unregister()',
  'window.caches.keys()',
  'window.location.replace(window.location.href);',
]) {
  if (!mainSource.includes(snippet)) {
    throw new Error(`Regression detected: stale PWA cleanup missing snippet: ${snippet}`);
  }
}

if (!mainSource.includes('isStaleTopicRouteLookupError') || !mainSource.includes('redirectForStaleTopicRoute')) {
  throw new Error('Regression detected: main.jsx no longer wires stale topic route recovery.');
}

if (!convexIdSource.includes('const CONVEX_ID_PATTERN = /^[a-z0-9]{32}$/;')) {
  throw new Error('Regression detected: Convex ID guard pattern changed unexpectedly.');
}

const routeGuardSnippets = [
  'const STALE_ROUTE_CACHE_TIMEOUT_MS = 300;',
  'const ROUTE_TOPIC_RESOLUTION_TIMEOUT_MS = 3000;',
  'const hasMismatchedCachedTopic = Boolean(routeTopicId && rawTopicId && rawTopicId !== routeTopicId);',
  'const routeLookupFailed = failedRouteKey === routeResolutionKey;',
  '&& (topicQueryResult === null || routeLookupTimedOut || routeLookupFailed)',
  "import { isStaleTopicRouteLookupError } from '../lib/chunkLoadRecovery.js';",
  'window.addEventListener(\'unhandledrejection\', handleUnhandledRejection);',
];

for (const snippet of routeGuardSnippets) {
  if (!routeResolvedTopicSource.includes(snippet)) {
    throw new Error(`Regression detected: route topic guard missing snippet: ${snippet}`);
  }
}

if (!chunkRecoverySource.includes('export const isStaleTopicRouteLookupError = (errorLike) => {')) {
  throw new Error('Regression detected: chunk recovery no longer identifies stale topic route lookup errors.');
}

if (!chunkRecoverySource.includes('const STALE_TOPIC_ROUTE_FOUND_ID_PATTERN =')) {
  throw new Error('Regression detected: stale topic route recovery no longer falls back to table-mismatch ID errors.');
}

if (!chunkRecoverySource.includes('window.location.replace(\'/dashboard\');')) {
  throw new Error('Regression detected: stale topic route redirect no longer targets the dashboard.');
}

if (!conceptIntroSource.includes('return <Navigate to={`/dashboard/concept/${topicId}`} replace />;')) {
  throw new Error('Regression detected: ConceptIntro.jsx no longer hard-redirects into the concept builder.');
}

const guardedPages = [
  { name: 'TopicDetail.jsx', source: topicDetailSource },
  { name: 'ExamMode.jsx', source: examModeSource },
  { name: 'ConceptBuilder.jsx', source: conceptBuilderSource },
];

for (const { name, source } of guardedPages) {
  if (!source.includes("api.topics.getTopicWithQuestions")) {
    throw new Error(`Regression detected: ${name} no longer uses the topic query.`);
  }
  if (!source.includes("routeTopicId ? { topicId: routeTopicId } : 'skip'")) {
    throw new Error(`Regression detected: ${name} no longer guards the topic query with routeTopicId.`);
  }
  if (!source.includes("useRouteResolvedTopic(routeTopicId, topicQueryResult)")) {
    throw new Error(`Regression detected: ${name} no longer resolves topic queries against the active route.`);
  }
  if (source.includes("isLikelyConvexId")) {
    throw new Error(`Regression detected: ${name} still relies on the stale Convex ID heuristic.`);
  }
}

for (const snippet of [
  "import { isStaleTopicRouteLookupError } from '../lib/chunkLoadRecovery';",
  'const isStaleConceptRouteError = (error) => {',
  'if (isStaleConceptRouteError(error)) {',
  'setHasStaleSessionRouteError(true);',
  'if (isMissingRouteTopic || hasStaleSessionRouteError) {',
]) {
  if (!conceptBuilderSource.includes(snippet)) {
    throw new Error(`Regression detected: ConceptBuilder stale-route fallback missing snippet: ${snippet}`);
  }
}

console.log('stale-client-guardrails-regression.test.mjs passed');
