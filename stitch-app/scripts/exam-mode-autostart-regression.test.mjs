import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const helpersPath = path.join(root, 'src', 'lib', 'topicLessonHelpers.js');
const nextStepsPath = path.join(root, 'src', 'components', 'NextStepsGuidance.jsx');
const hookPath = path.join(root, 'src', 'hooks', 'useTopicDetail.js');

const [helpersSource, nextStepsSource, hookSource] = await Promise.all([
  fs.readFile(helpersPath, 'utf8'),
  fs.readFile(nextStepsPath, 'utf8'),
  fs.readFile(hookPath, 'utf8'),
]);

if (!helpersSource.includes('export const buildTopicQuizRoute')) {
  throw new Error('Expected buildTopicQuizRoute helper.');
}
if (!helpersSource.includes('export const buildEssayQuizRoute')) {
  throw new Error('Expected buildEssayQuizRoute helper.');
}
if (!helpersSource.includes('autostart=mcq')) {
  throw new Error('Expected topic quiz route to deep-link mcq autostart.');
}
if (!helpersSource.includes('autostart=essay')) {
  throw new Error('Expected essay quiz route to deep-link essay autostart.');
}
if (helpersSource.includes('buildObjectiveExamRoute')) {
  throw new Error('Hard cutover: buildObjectiveExamRoute must be removed.');
}

if (!nextStepsSource.includes('buildTopicQuizRoute')) {
  throw new Error('NextStepsGuidance must build a shared autostart quiz route.');
}
if (!nextStepsSource.includes('autostart=mcq')) {
  throw new Error('NextStepsGuidance must deep-link quiz CTAs into objective mode.');
}
if (!nextStepsSource.includes('buildEssayQuizRoute')) {
  throw new Error('NextStepsGuidance must build a separate essay quiz route.');
}
if (/reloadDocument:\s*true/.test(nextStepsSource) || /reloadDocument:\s*action\.reloadDocument/.test(nextStepsSource)) {
  throw new Error('NextStepsGuidance quiz CTAs must not force a document reload.');
}

if (!hookSource.includes('buildTopicQuizRoute')) {
  throw new Error('useTopicDetail must use buildTopicQuizRoute.');
}
if (!hookSource.includes('buildEssayQuizRoute')) {
  throw new Error('useTopicDetail must use buildEssayQuizRoute.');
}

console.log('exam-mode-autostart-regression.test.mjs passed');
