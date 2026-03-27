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

if (!convexIdSource.includes('const CONVEX_ID_PATTERN = /^[a-z0-9]{32}$/;')) {
  throw new Error('Regression detected: Convex ID guard pattern changed unexpectedly.');
}

const routeGuardSnippets = [
  'const STALE_ROUTE_CACHE_TIMEOUT_MS = 300;',
  'const ROUTE_TOPIC_RESOLUTION_TIMEOUT_MS = 3000;',
  'const hasMismatchedCachedTopic = Boolean(routeTopicId && rawTopicId && rawTopicId !== routeTopicId);',
  'const isMissingRouteTopic = Boolean(routeTopicId) && (topicQueryResult === null || routeLookupTimedOut) && !routeTopic;',
];

for (const snippet of routeGuardSnippets) {
  if (!routeResolvedTopicSource.includes(snippet)) {
    throw new Error(`Regression detected: route topic guard missing snippet: ${snippet}`);
  }
}

const guardedPages = [
  { name: 'ConceptIntro.jsx', source: conceptIntroSource },
  { name: 'TopicDetail.jsx', source: topicDetailSource },
  { name: 'ExamMode.jsx', source: examModeSource },
];

for (const { name, source } of guardedPages) {
  if (!source.includes("import { isLikelyConvexId } from '../lib/convexId';")) {
    throw new Error(`Regression detected: ${name} no longer imports the Convex ID guard helper.`);
  }
  if (!source.includes('const topicId = isLikelyConvexId(normalizedTopicId) ? normalizedTopicId : \'\';')) {
    throw new Error(`Regression detected: ${name} no longer normalizes topicId with isLikelyConvexId.`);
  }
  if (!source.includes("useRouteResolvedTopic(routeTopicId, topicQueryResult)")) {
    throw new Error(`Regression detected: ${name} no longer resolves topic queries against the active route.`);
  }
  if (source.includes("isLikelyConvexId")) {
    throw new Error(`Regression detected: ${name} still relies on the stale Convex ID heuristic.`);
  }
}

console.log('stale-client-guardrails-regression.test.mjs passed');
