import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'convex', 'schema.ts');
const topicsPath = path.join(root, 'convex', 'topics.ts');
const aiPath = path.join(root, 'convex', 'ai.ts');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');
const processingPath = path.join(root, 'src', 'pages', 'DashboardProcessing.jsx');

const [schemaSource, topicsSource, aiSource, topicDetailSource, processingSource] = await Promise.all([
  fs.readFile(schemaPath, 'utf8'),
  fs.readFile(topicsPath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
  fs.readFile(topicDetailPath, 'utf8'),
  fs.readFile(processingPath, 'utf8'),
]);

for (const field of [
  'examReady: v.optional(v.boolean())',
  'objectiveTargetCount: v.optional(v.number())',
  'essayTargetCount: v.optional(v.number())',
  'usableObjectiveCount: v.optional(v.number())',
  'usableEssayCount: v.optional(v.number())',
]) {
  if (!schemaSource.includes(field)) {
    throw new Error(`Expected topics schema to include ${field}.`);
  }
}

for (const pattern of [
  'export const refreshTopicExamReadinessInternal = internalMutation',
  'examReady: false,',
  'usableObjectiveCount: 0,',
  'usableEssayCount: 0,',
]) {
  if (!topicsSource.includes(pattern)) {
    throw new Error(`Expected topics.ts to include "${pattern}" for persisted exam readiness.`);
  }
}

for (const removedPattern of [
  'const scheduleExamQuestionPrebuildForTopic = async',
  'const scheduleQuestionBanksForCourse = async',
  'processingStep: "generating_question_bank"',
]) {
  if (aiSource.includes(removedPattern)) {
    throw new Error(`Regression detected: ai.ts should not include eager exam prebuild snippet "${removedPattern}".`);
  }
}

if (processingSource.includes("key: 'generating_question_bank'")) {
  throw new Error('Regression detected: DashboardProcessing should not expose a generating_question_bank upload phase.');
}

if (!topicDetailSource.includes('const topicExamReady =')) {
  throw new Error('Expected TopicDetail to derive a topicExamReady state.');
}

if (!topicDetailSource.includes('const topicObjectiveTargetCount =')) {
  throw new Error('Expected TopicDetail to derive a per-topic objective target count.');
}

if (!topicDetailSource.includes("onClick={() => handleStartExam(OBJECTIVE_EXAM_FORMAT)}")) {
  throw new Error('Expected TopicDetail objective CTA to route through the on-demand start handler.');
}

if (/generateQuestions\(\{\s*topicId\s*\}\)/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not generate objective questions directly.');
}

if (/requestEssayQuestionTopUp/.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not prewarm essay questions.');
}

console.log('exam-ready-prebuild-regression.test.mjs passed');
