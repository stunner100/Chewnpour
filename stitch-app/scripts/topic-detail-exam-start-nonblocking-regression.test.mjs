import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const source = await fs.readFile(topicDetailPath, 'utf8');

const startPattern = /const handleStartExam = async \((?:preferredFormat = (?:'mcq'|OBJECTIVE_EXAM_FORMAT))?\) => \{/;
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

if (/await\s+generateQuestions\(\{\s*topicId\s*\}\)/.test(handleStartExamSource)) {
  throw new Error('Regression detected: handleStartExam blocks navigation by awaiting question generation.');
}

if (/generateQuestions\(\{\s*topicId\s*\}\)/.test(handleStartExamSource)) {
  throw new Error('Regression detected: handleStartExam should not trigger on-demand question generation.');
}

if (/preferredFormat === OBJECTIVE_EXAM_FORMAT && !topicObjectiveStartReady/.test(handleStartExamSource)) {
  throw new Error('Regression detected: Objective launch should not be blocked by topicObjectiveStartReady.');
}

if (/Objective questions are still preparing/.test(handleStartExamSource)) {
  throw new Error('Regression detected: Objective launch should not show readiness blocking errors.');
}

if (!/navigate\(`\/dashboard\/exam\/\$\{topicId\}`,\s*\{[\s\S]*preferredFormat,\s*[\s\S]*source:\s*'topic_detail'/.test(handleStartExamSource)) {
  throw new Error('Expected handleStartExam to navigate with selected preferredFormat and topic_detail source.');
}

if (!/if \(preferredFormat === 'essay' && !topicEssayStartReady\)/.test(handleStartExamSource)) {
  throw new Error('Expected handleStartExam to block essay launch until essay readiness is met.');
}

console.log('topic-detail-exam-start-nonblocking-regression.test.mjs passed');
