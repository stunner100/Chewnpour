import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const conceptsPath = path.join(root, 'convex', 'concepts.ts');
const masteryPath = path.join(root, 'convex', 'lib', 'conceptMastery.js');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');

const [conceptsSource, masterySource, topicDetailSource] = await Promise.all([
  fs.readFile(conceptsPath, 'utf8'),
  fs.readFile(masteryPath, 'utf8'),
  fs.readFile(topicDetailPath, 'utf8'),
]);

if (!/buildConceptMasterySummaryFromAttempts/.test(masterySource)) {
  throw new Error('Expected concept mastery library to reconstruct mastery summaries from saved attempts.');
}

if (!/["']attempt_fallback["']/.test(conceptsSource)) {
  throw new Error('Expected getConceptMasteryForTopic to expose attempt_fallback when mastery rows are missing.');
}

if (!/query\("conceptAttempts"\)|\.query\("conceptAttempts"\)/.test(conceptsSource)) {
  throw new Error('Expected getConceptMasteryForTopic to inspect conceptAttempts when mastery rows are empty.');
}

if (!topicDetailSource.includes('Topic review CTA using concept-attempt fallback')) {
  throw new Error('Expected TopicDetail to emit an observability signal when the topic CTA uses attempt fallback.');
}

if (!/conceptMastery\?\.source\s*!==\s*'attempt_fallback'/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to guard fallback observability behind the attempt_fallback source.');
}

console.log('topic-review-cta-fallback-regression: ok');
