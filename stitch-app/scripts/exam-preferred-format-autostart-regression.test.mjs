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

if (!/useNavigate,\s*useLocation/.test(examModeSource)) {
  throw new Error('Expected ExamMode to import useLocation for preferred-format handoff.');
}

if (!examModeSource.includes('const preferredFormatFromState = resolvePreferredExamFormat(location?.state?.preferredFormat);')) {
  throw new Error('Expected ExamMode to resolve preferredFormat from route state.');
}

if (!examModeSource.includes('if (examFormat || !preferredFormatFromState) return;')) {
  throw new Error('Expected ExamMode preferred-format effect to skip when format is already selected.');
}

if (!examModeSource.includes('setExamFormat(preferredFormatFromState);')) {
  throw new Error('Expected ExamMode preferred-format effect to auto-select route format.');
}

if (!topicDetailSource.includes("const handleStartExam = async (preferredFormat = 'mcq') => {")) {
  throw new Error('Expected TopicDetail handleStartExam to accept preferredFormat override.');
}

if (!/onClick=\{\(\) => handleStartExam\('mcq'\)\}/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to expose explicit MCQ exam launch.');
}

if (!/onClick=\{\(\) => handleStartExam\('essay'\)\}/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail to expose explicit Essay exam launch.');
}

console.log('exam-preferred-format-autostart-regression.test.mjs passed');
