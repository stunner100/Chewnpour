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

for (const field of ['examReady: v.optional(v.boolean())', 'mcqTargetCount: v.optional(v.number())', 'usableMcqCount: v.optional(v.number())', 'usableEssayCount: v.optional(v.number())']) {
  if (!schemaSource.includes(field)) {
    throw new Error(`Expected topics schema to include ${field}.`);
  }
}

for (const pattern of ['export const refreshTopicExamReadinessInternal = internalMutation', 'examReady: false,', 'usableMcqCount: 0,', 'usableEssayCount: 0,']) {
  if (!topicsSource.includes(pattern)) {
    throw new Error(`Expected topics.ts to include "${pattern}" for persisted exam readiness.`);
  }
}

for (const pattern of ['const scheduleExamQuestionPrebuildForTopic = async', 'internal.ai.generateQuestionsForTopicInternal', 'internal.ai.generateEssayQuestionsForTopicInternal']) {
  if (!aiSource.includes(pattern)) {
    throw new Error(`Expected ai.ts to include "${pattern}" for topic prebuild scheduling.`);
  }
}

if (!/reason:\s*"topic_created"/.test(aiSource)) {
  throw new Error('Expected topic creation path to schedule exam prebuild.');
}

if (!/reason:\s*"upload_completion"/.test(aiSource)) {
  throw new Error('Expected upload-completion path to schedule exam prebuild.');
}

if (!topicDetailSource.includes('const topicExamReady =')) {
  throw new Error('Expected TopicDetail to derive a topicExamReady state.');
}

if (!topicDetailSource.includes('const topicQuizStartReady =')) {
  throw new Error('Expected TopicDetail to derive topicQuizStartReady from MCQ readiness.');
}

if (!topicDetailSource.includes('const topicMcqTargetCount =')) {
  throw new Error('Expected TopicDetail to derive a per-topic MCQ target count.');
}

if (!topicDetailSource.includes("onClick={() => handleStartExam('mcq')}")) {
  throw new Error('Expected TopicDetail Take Quiz CTA to route through the MCQ start handler.');
}

if (!topicDetailSource.includes('MCQ and ${usableEssayCount}/${EXAM_READY_MIN_ESSAY_COUNT} essay questions ready.')) {
  throw new Error('Expected TopicDetail to show readiness progress while exam assets are still building.');
}

if (/generateQuestions\(\{\s*topicId\s*\}\)/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not generate quiz questions on Take Quiz click.');
}

console.log('exam-ready-prebuild-regression.test.mjs passed');
