import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const source = await fs.readFile(topicDetailPath, 'utf8');

for (const forbiddenPattern of [
  /await\s+generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateEssayQuestions\(\{/,
  /preferredFormat/,
  /topicQuizStartReady/,
  /topicEssayStartReady/,
]) {
  if (forbiddenPattern.test(source)) {
    throw new Error('Regression detected: TopicDetail Start Exam should not do format-specific generation or readiness checks.');
  }
}

if (!source.includes('const buildObjectiveExamRoute = (examTopicId) =>')) {
  throw new Error('Expected TopicDetail to centralize the default autostart exam route.');
}

if (!source.includes("autostart=mcq")) {
  throw new Error('Expected TopicDetail Start Exam CTA to deep-link into objective mode.');
}

if (!source.includes('reloadDocument')) {
  throw new Error('Expected TopicDetail Start Exam CTA to use hard document navigation.');
}

console.log('topic-detail-exam-start-nonblocking-regression.test.mjs passed');
