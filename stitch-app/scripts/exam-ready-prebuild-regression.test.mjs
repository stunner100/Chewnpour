import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'convex', 'schema.ts');
const topicsPath = path.join(root, 'convex', 'topics.ts');
const aiPath = path.join(root, 'convex', 'ai.ts');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');

const [schemaSource, topicsSource, aiSource, topicDetailSource] = await Promise.all([
  fs.readFile(schemaPath, 'utf8'),
  fs.readFile(topicsPath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
  fs.readFile(topicDetailPath, 'utf8'),
]);

for (const field of ['examReady: v.optional(v.boolean())', 'mcqTargetCount: v.optional(v.number())', 'essayTargetCount: v.optional(v.number())', 'usableMcqCount: v.optional(v.number())', 'usableEssayCount: v.optional(v.number())']) {
  if (!schemaSource.includes(field)) {
    throw new Error(`Expected topics schema to include ${field}.`);
  }
}

for (const pattern of ['export const refreshTopicExamReadinessInternal = internalMutation', 'examReady: false,', 'usableMcqCount: 0,', 'usableEssayCount: 0,']) {
  if (!topicsSource.includes(pattern)) {
    throw new Error(`Expected topics.ts to include "${pattern}" for persisted exam readiness.`);
  }
}

if (aiSource.includes('const scheduleExamQuestionPrebuildForTopic = async')) {
  throw new Error('Regression detected: ai.ts should no longer define topic exam prebuild scheduling.');
}

if (/reason:\s*"topic_created"/.test(aiSource) || /reason:\s*"upload_completion"/.test(aiSource)) {
  throw new Error('Regression detected: ai.ts should not schedule exam generation during topic creation or upload completion.');
}

if (!aiSource.includes('when the user clicks "Start Exam".')) {
  throw new Error('Expected ai.ts upload flow to document that exam generation now starts on Start Exam click.');
}

if (!topicDetailSource.includes('const examRoute = topicId ? `/dashboard/exam/${topicId}` : \'/dashboard\';')) {
  throw new Error('Expected TopicDetail Start Exam CTA to compute a direct exam route.');
}

if (!topicDetailSource.includes('Start Exam')) {
  throw new Error('Expected TopicDetail to render a single Start Exam CTA.');
}

if (/MCQ Quiz|Essay Quiz/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not render separate MCQ or Essay quiz buttons.');
}

for (const removedPattern of [
  'topicExamReady',
  'topicQuizStartReady',
  'topicEssayStartReady',
  'questionBankDisplay',
  'useMutation(api.exams.requestEssayQuestionTopUp)',
]) {
  if (topicDetailSource.includes(removedPattern)) {
    throw new Error(`Regression detected: TopicDetail should not use legacy exam readiness plumbing (${removedPattern}).`);
  }
}

if (!topicDetailSource.includes('reloadDocument')) {
  throw new Error('Expected TopicDetail Start Exam CTA to use hard document navigation to ExamMode.');
}

console.log('exam-ready-prebuild-regression.test.mjs passed');
