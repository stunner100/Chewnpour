import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const selectorPath = path.join(root, 'src', 'components', 'StudyModeSelector.jsx');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const helpersPath = path.join(root, 'src', 'lib', 'topicLessonHelpers.js');
const topicDetailHookPath = path.join(root, 'src', 'hooks', 'useTopicDetail.js');

const [selectorSource, topicDetailSource, helpersSource, hookSource] = await Promise.all([
  fs.readFile(selectorPath, 'utf8'),
  fs.readFile(topicDetailPath, 'utf8'),
  fs.readFile(helpersPath, 'utf8'),
  fs.readFile(topicDetailHookPath, 'utf8'),
]);

if (!selectorSource.includes('onStartExam')) {
  throw new Error('Expected StudyModeSelector to accept an onStartExam prop.');
}

if (!selectorSource.includes('Start timed exam')) {
  throw new Error('Expected StudyModeSelector to render a Start timed exam CTA.');
}

if (!selectorSource.includes('Want to test yourself now?')) {
  throw new Error('Expected StudyModeSelector to explain the direct exam entry path.');
}

if (!topicDetailSource.includes('onStartExam={controller.handleStartExam}')) {
  throw new Error('Expected TopicDetail to wire StudyModeSelector into handleStartExam.');
}

if (!helpersSource.includes('export const buildTimedExamRoute')) {
  throw new Error('Expected timed exam route helper.');
}

if (!hookSource.includes('buildTimedExamRoute(courseId)')) {
  throw new Error('Expected TopicDetail exam entry to route to timed exams with courseId.');
}

if (!/navigate\(timedExamRoute\)/.test(hookSource)) {
  throw new Error('Expected handleStartExam to navigate to the timed exam route.');
}

console.log('topic-study-mode-exam-entry-regression.test.mjs passed');
