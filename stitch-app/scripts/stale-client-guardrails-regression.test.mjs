import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [chunkRecoverySource, mainSource, convexIdSource, conceptIntroSource, topicDetailSource, examModeSource, conceptBuilderSource] =
  await Promise.all([
    read('src/lib/chunkLoadRecovery.js'),
    read('src/main.jsx'),
    read('src/lib/convexId.js'),
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

if (!convexIdSource.includes('const CONVEX_ID_PATTERN = /^[a-z0-9]{32}$/;')) {
  throw new Error('Regression detected: Convex ID guard pattern changed unexpectedly.');
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
  if (source.includes("isLikelyConvexId")) {
    throw new Error(`Regression detected: ${name} still relies on the stale Convex ID heuristic.`);
  }
}

console.log('stale-client-guardrails-regression.test.mjs passed');
