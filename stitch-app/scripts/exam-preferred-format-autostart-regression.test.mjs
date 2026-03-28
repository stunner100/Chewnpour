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

if (!topicDetailSource.includes('const examRoute = topicId ? `/dashboard/exam/${topicId}` : \'/dashboard\';')) {
  throw new Error('Expected TopicDetail to compute a direct exam route.');
}

if (!topicDetailSource.includes('reloadDocument')) {
  throw new Error('Expected TopicDetail Start Exam CTA to use hard document navigation without route-state format hints.');
}

console.log('exam-preferred-format-autostart-regression.test.mjs passed');
