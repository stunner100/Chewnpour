import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const source = await fs.readFile(topicDetailPath, 'utf8');

const startPattern = /const handleStartExam = async \((?:preferredFormat = 'mcq')?\) => \{/;
const endMarker = '\n\n    if (!topicId) {';
const startIndex = source.search(startPattern);
if (startIndex === -1) {
  throw new Error('Expected TopicDetail to define handleStartExam.');
}

const endIndex = source.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  throw new Error('Unable to isolate handleStartExam in TopicDetail.');
}

const handleStartExamSource = source.slice(startIndex, endIndex);

for (const forbiddenPattern of [
  /await\s+generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateEssayQuestions\(\{/,
  /preferredFormat/,
  /topicQuizStartReady/,
  /topicEssayStartReady/,
]) {
  if (forbiddenPattern.test(handleStartExamSource)) {
    throw new Error('Regression detected: TopicDetail Start Exam should not do format-specific generation or readiness checks.');
  }
}

if (!/navigate\(`\/dashboard\/exam\/\$\{topicId\}`\);/.test(handleStartExamSource)) {
  throw new Error('Expected handleStartExam to navigate directly to ExamMode.');
}

console.log('topic-detail-exam-start-nonblocking-regression.test.mjs passed');
