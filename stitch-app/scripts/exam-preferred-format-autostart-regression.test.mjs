import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');

const [examModeSource, topicDetailSource] = await Promise.all([
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(topicDetailPath, 'utf8'),
]);

if (/useLocation/.test(examModeSource)) {
  throw new Error('Regression detected: ExamMode should not import useLocation for preferred-format handoff.');
}

for (const forbiddenPattern of [
  'preferredFormatFromState',
  'location?.state?.preferredFormat',
  "handleStartExam('mcq')",
  "handleStartExam('essay')",
]) {
  if (examModeSource.includes(forbiddenPattern) || topicDetailSource.includes(forbiddenPattern)) {
    throw new Error(`Regression detected: preferred-format autostart should be removed (${forbiddenPattern}).`);
  }
}

if (!examModeSource.includes('Choose Exam Format')) {
  throw new Error('Expected ExamMode to let the user choose format inside the exam flow.');
}

if (!topicDetailSource.includes('const handleStartExam = async () => {')) {
  throw new Error('Expected TopicDetail to route through a single Start Exam handler.');
}

if (!/navigate\(`\/dashboard\/exam\/\$\{topicId\}`\);/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to navigate to ExamMode without route-state format hints.');
}

console.log('exam-preferred-format-autostart-regression.test.mjs passed');
