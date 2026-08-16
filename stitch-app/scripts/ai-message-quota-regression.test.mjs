import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const topicChatPanelSource = await read('src/components/TopicChatPanel.jsx');
for (const pattern of [
  'api.subscriptions.getAiMessageQuotaStatus',
  'AI_MESSAGE_QUOTA_EXCEEDED',
  "reason: 'ai_message_limit'",
  'Upgrade to premium',
]) {
  if (topicChatPanelSource.includes(pattern)) {
    throw new Error(`TopicChatPanel.jsx must not keep AI message quota paywall leftover "${pattern}".`);
  }
}
if (!topicChatPanelSource.includes('StudyWorkerChat')) {
  throw new Error('Expected TopicChatPanel to use the free study worker chat.');
}

const assignmentSource = await read('src/pages/AssignmentHelper.jsx');
if (!assignmentSource.includes('ParkedFeatureView')) {
  throw new Error('Expected AssignmentHelper to stay parked instead of selling a paid follow-up quota.');
}

const subscriptionSource = await read('src/pages/Subscription.jsx');
if (!subscriptionSource.includes('Navigate to="/dashboard"')) {
  throw new Error('Expected Subscription.jsx to redirect to the dashboard.');
}

console.log('ai-message-quota-regression.test.mjs passed');
