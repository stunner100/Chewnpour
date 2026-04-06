import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const source = await fs.readFile(topicDetailPath, 'utf8');

const match = source.match(/const handleStartExam = async \(\) => \{[\s\S]*?\n    \};/);
if (!match) {
  throw new Error('Expected TopicDetail to define handleStartExam.');
}
const handleStartExamSource = match[0];

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
