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

if (!source.includes('const examRoute = topicId ? `/dashboard/exam/${topicId}` : \'/dashboard\';')) {
  throw new Error('Expected TopicDetail Start Exam CTA to compute a direct exam route.');
}

if (!source.includes('reloadDocument')) {
  throw new Error('Expected TopicDetail Start Exam CTA to use hard document navigation.');
}

console.log('topic-detail-exam-start-nonblocking-regression.test.mjs passed');
