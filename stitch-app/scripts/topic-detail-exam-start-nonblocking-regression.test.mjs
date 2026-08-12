import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const hookPath = path.join(root, 'src', 'hooks', 'useTopicDetail.js');
const helpersPath = path.join(root, 'src', 'lib', 'topicLessonHelpers.js');

const [source, hookSource, helpersSource] = await Promise.all([
  fs.readFile(topicDetailPath, 'utf8'),
  fs.readFile(hookPath, 'utf8'),
  fs.readFile(helpersPath, 'utf8'),
]);

for (const forbiddenPattern of [
  /await\s+generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateEssayQuestions\(\{/,
  /preferredFormat/,
  /topicQuizStartReady/,
  /topicEssayStartReady/,
]) {
  if (forbiddenPattern.test(source) || forbiddenPattern.test(hookSource)) {
    throw new Error('Regression detected: TopicDetail Start Exam should not do format-specific generation or readiness checks.');
  }
}

if (!helpersSource.includes('export const buildTopicQuizRoute')) {
  throw new Error('Expected topic quiz route helper.');
}

if (!helpersSource.includes('autostart=mcq')) {
  throw new Error('Expected topic quiz CTA to deep-link into objective mode.');
}

if (!helpersSource.includes('export const buildEssayQuizRoute')) {
  throw new Error('Expected essay quiz route helper.');
}

if (!helpersSource.includes('autostart=essay')) {
  throw new Error('Expected essay quiz CTA to deep-link into essay mode.');
}

for (const expectedLabel of [
  'Start essay',
  'Retry quiz',
  'Start quiz',
]) {
  if (!hookSource.includes(expectedLabel)) {
    throw new Error(`Expected TopicDetail CTA set to include ${expectedLabel}.`);
  }
}

if (source.includes('reloadDocument') || hookSource.includes('reloadDocument')) {
  throw new Error('Regression detected: TopicDetail Start Exam CTA must use SPA navigation, not hard document navigation.');
}

console.log('topic-detail-exam-start-nonblocking-regression.test.mjs passed');
