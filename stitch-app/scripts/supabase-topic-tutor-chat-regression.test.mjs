import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const migration = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724131000_topic_chat_messages.sql'),
  'utf8',
);
if (!/CREATE TABLE IF NOT EXISTS "topic_chat_messages"/.test(migration)) {
  throw new Error('Expected topic chat migration to create topic_chat_messages.');
}

const topicChat = await fs.readFile(path.join(root, 'server', 'topicChat.js'), 'utf8');
for (const symbol of ['listTopicChatMessages', 'askTopicTutor', 'clearTopicChat']) {
  if (!topicChat.includes(`export const ${symbol}`)) {
    throw new Error(`Expected server/topicChat.js to export ${symbol}.`);
  }
}

const courseHttp = await fs.readFile(path.join(root, 'server', 'courseHttp.js'), 'utf8');
if (!/parts\[1\] === "study-worker-token"/.test(courseHttp) || !/signStudyWorkerToken/.test(courseHttp)) {
  throw new Error('Expected topics HTTP handler to mint study-worker tokens.');
}

for (const relativePath of [
  'src/components/TopicChatPanel.jsx',
  'src/components/topic/TopicLessonViews.jsx',
  'src/pages/AIStudyTutor.jsx',
]) {
  const source = await fs.readFile(path.join(root, relativePath), 'utf8');
  if (/from ['"]convex\/react['"]/.test(source) || /api\.topicChat|api\.ai\.askTopicTutor/.test(source)) {
    throw new Error(`Expected ${relativePath} to stop depending on Convex tutor chat.`);
  }
}

const lessonViews = await fs.readFile(path.join(root, 'src', 'components', 'topic', 'TopicLessonViews.jsx'), 'utf8');
const topicChatPanel = await fs.readFile(path.join(root, 'src', 'components', 'TopicChatPanel.jsx'), 'utf8');
if (!/Open AI Tutor/.test(lessonViews) || !/onAsk=\{handleAskTutor\}/.test(lessonViews)) {
  throw new Error('Expected TopicStudyAssistantCard to open the shared TopicChatPanel tutor entry.');
}
if (!/StudyWorkerChat/.test(topicChatPanel)) {
  throw new Error('Expected TopicChatPanel to use the eve study worker.');
}

console.log('supabase-topic-tutor-chat-regression.test.mjs passed');
