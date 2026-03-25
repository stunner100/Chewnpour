import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const prewarmPath = path.join(root, 'src', 'lib', 'examQuestionPrewarm.js');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const aiPath = path.join(root, 'convex', 'ai.ts');

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

if (await fileExists(prewarmPath)) {
  throw new Error('Regression detected: exam prewarm helper should be removed after the click-to-generate cutover.');
}

const [topicDetailSource, examModeSource, aiSource] = await Promise.all([
  fs.readFile(topicDetailPath, 'utf8'),
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
]);

if (/prewarm/i.test(topicDetailSource) || /prewarm/i.test(examModeSource)) {
  throw new Error('Regression detected: student exam flow should not reference prewarm behavior.');
}

if (/scheduleExamQuestionPrebuildForTopic/.test(aiSource)) {
  throw new Error('Regression detected: backend should not retain topic prebuild helpers after the click-to-generate cutover.');
}

console.log('exam-question-prewarm-regression tests passed');
