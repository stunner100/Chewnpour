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

if (/export const requestEssayQuestionTopUp = mutation\(/.test(examsSource)) {
  throw new Error('Regression detected: exams.ts should not expose requestEssayQuestionTopUp after the on-demand cutover.');
}

if (/generateEssayQuestionsForTopicInternal/.test(topicDetailSource) || /requestEssayQuestionTopUp/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not schedule essay generation directly.');
}

if (!/onClick=\{\(\) => handleStartExam\('essay'\)\}/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail essay CTA to use handleStartExam.');
}

console.log('topic-detail-essay-topup-regression.test.mjs passed');
