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

if (!/useMutation\(api\.exams\.requestEssayQuestionTopUp\)/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to wire requestEssayQuestionTopUp mutation.');
}

if (!/minimumCount:\s*topicEssayTargetCount/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail essay top-up request to use the derived per-topic essay target.');
}

if (!/Failed to schedule essay question top-up/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to log essay top-up scheduling failures.');
}

console.log('topic-detail-essay-topup-regression.test.mjs passed');
