import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const helpersPath = path.join(root, 'src', 'lib', 'topicLessonHelpers.js');
const hookPath = path.join(root, 'src', 'hooks', 'useTopicDetail.js');

const [helpersSource, hookSource] = await Promise.all([
  fs.readFile(helpersPath, 'utf8'),
  fs.readFile(hookPath, 'utf8'),
]);

if (!helpersSource.includes('export const buildTopicQuizRoute')) {
  throw new Error('Expected buildTopicQuizRoute helper.');
}
if (!helpersSource.includes('export const buildEssayQuizRoute')) {
  throw new Error('Expected buildEssayQuizRoute helper.');
}
if (helpersSource.includes('autostart=')) {
  throw new Error('Dead autostart param must not be emitted by quiz route builders.');
}
if (helpersSource.includes('buildObjectiveExamRoute')) {
  throw new Error('Hard cutover: buildObjectiveExamRoute must be removed.');
}

if (!hookSource.includes('buildTopicQuizRoute')) {
  throw new Error('useTopicDetail must use buildTopicQuizRoute.');
}
if (!hookSource.includes('buildEssayQuizRoute')) {
  throw new Error('useTopicDetail must use buildEssayQuizRoute.');
}

console.log('exam-mode-autostart-regression.test.mjs passed');
