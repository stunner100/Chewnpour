import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [chunkRecoverySource, mainSource, convexIdSource, conceptIntroSource, topicDetailSource, examModeSource] =
  await Promise.all([
    read('src/lib/chunkLoadRecovery.js'),
    read('src/main.jsx'),
    read('src/lib/convexId.js'),
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
  if (!source.includes("topicId ? { topicId } : 'skip'")) {
    throw new Error(`Regression detected: ${name} query is no longer guarded by validated topicId.`);
  }
}

console.log('stale-client-guardrails-regression.test.mjs passed');
