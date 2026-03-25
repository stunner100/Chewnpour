import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examsPath = path.join(root, 'convex', 'exams.ts');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');

const [examsSource, topicDetailSource] = await Promise.all([
  fs.readFile(examsPath, 'utf8'),
  fs.readFile(topicDetailPath, 'utf8'),
]);

if (!/export const requestEssayQuestionTopUp = mutation\(/.test(examsSource)) {
  throw new Error('Expected exams.ts to expose requestEssayQuestionTopUp mutation.');
}

if (!/ctx\.scheduler\.runAfter\(\s*0,\s*internal\.ai\.generateEssayQuestionsForTopicInternal/s.test(examsSource)) {
  throw new Error('Expected requestEssayQuestionTopUp to schedule internal essay generation.');
}

if (/useMutation\(api\.exams\.requestEssayQuestionTopUp\)/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not wire essay top-up into the student flow.');
}

if (/minimumCount:\s*topicEssayTargetCount/.test(topicDetailSource) || /Failed to schedule essay question top-up/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not contain legacy essay top-up request logic.');
}

if (/Essay Quiz/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should expose a single Start Exam CTA, not a dedicated essay quiz button.');
}

console.log('topic-detail-essay-topup-regression.test.mjs passed');
