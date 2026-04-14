import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const selectorPath = path.join(root, 'src', 'components', 'StudyModeSelector.jsx');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');

const [selectorSource, topicDetailSource] = await Promise.all([
  fs.readFile(selectorPath, 'utf8'),
  fs.readFile(topicDetailPath, 'utf8'),
]);

if (!selectorSource.includes('onStartExam')) {
  throw new Error('Expected StudyModeSelector to accept an onStartExam prop.');
}

if (!selectorSource.includes('Start Exam')) {
  throw new Error('Expected StudyModeSelector to render a Start Exam CTA.');
}

if (!selectorSource.includes('Want to test yourself now?')) {
  throw new Error('Expected StudyModeSelector to explain the direct exam entry path.');
}

if (!topicDetailSource.includes('onStartExam={handleStartExam}')) {
  throw new Error('Expected TopicDetail to wire StudyModeSelector into handleStartExam.');
}

if (!/navigate\(`\/dashboard\/exam\/\$\{topicId\}`\);/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail exam entry to route directly to ExamMode.');
}

console.log('topic-study-mode-exam-entry-regression.test.mjs passed');
