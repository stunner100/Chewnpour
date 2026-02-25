import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const source = await fs.readFile(topicDetailPath, 'utf8');

const startMarker = 'const handleStartExam = async () => {';
const endMarker = '\n\n    if (!topicId) {';
const startIndex = source.indexOf(startMarker);
if (startIndex === -1) {
  throw new Error('Expected TopicDetail to define handleStartExam.');
}

const endIndex = source.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  throw new Error('Unable to isolate handleStartExam in TopicDetail.');
}

const handleStartExamSource = source.slice(startIndex, endIndex);

if (/await\s+generateQuestions\(\{\s*topicId\s*\}\)/.test(handleStartExamSource)) {
  throw new Error('Regression detected: handleStartExam blocks navigation by awaiting question generation.');
}

if (!/generateQuestions\(\{\s*topicId\s*\}\)\.catch\(/.test(handleStartExamSource)) {
  throw new Error('Expected handleStartExam to warm questions in background with an explicit catch handler.');
}

if (!/navigate\(`\/dashboard\/exam\/\$\{topicId\}`\)/.test(handleStartExamSource)) {
  throw new Error('Expected handleStartExam to navigate to exam route immediately.');
}

console.log('topic-detail-exam-start-nonblocking-regression.test.mjs passed');
