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
];

for (const signature of requiredStaleSignatures) {
  if (!chunkRecoverySource.includes(signature)) {
    throw new Error(`Regression detected: stale Convex signature missing from chunk recovery: ${signature}`);
  }
}

if (!mainSource.includes('const triggerPwaUpdateReload = (updateServiceWorker) =>')) {
  throw new Error('Regression detected: PWA update reload helper missing.');
}

if (!/onNeedRefresh\(\)\s*{[\s\S]*triggerPwaUpdateReload\(updateServiceWorker\);/.test(mainSource)) {
  throw new Error('Regression detected: onNeedRefresh no longer triggers forced SW update reload.');
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

if (!chunkRecoverySource.includes('window.location.replace(\'/dashboard\');')) {
  throw new Error('Regression detected: stale topic route redirect no longer targets the dashboard.');
}

const guardedPages = [
  { name: 'ConceptIntro.jsx', source: conceptIntroSource },
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

console.log('stale-client-guardrails-regression.test.mjs passed');
