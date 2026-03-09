import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const schemaSource = await read('convex/schema.ts');
for (const pattern of [
  'aiMessageUsage: defineTable({',
  '.index("by_userId_date", ["userId", "date"]),',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected schema to include "${pattern}" for AI message usage tracking.`);
  }
}

const subscriptionsSource = await read('convex/subscriptions.ts');
for (const pattern of [
  'const FREE_AI_MESSAGE_DAILY_LIMIT = 2;',
  'const getAiMessageUsageToday = async (ctx: any, userId: string) => {',
  'export const getAiMessageQuotaStatus = query({',
  'export const consumeAiMessageCreditOrThrow = mutation({',
  'code: "AI_MESSAGE_QUOTA_EXCEEDED"',
  'ctx.db.insert("aiMessageUsage", { userId, date, count: nextCount });',
]) {
  if (!subscriptionsSource.includes(pattern)) {
    throw new Error(`Expected subscriptions.ts to include "${pattern}" for AI message quota.`);
  }
}

const aiSource = await read('convex/ai.ts');
const consumeMatches = aiSource.match(/api\.subscriptions\.consumeAiMessageCreditOrThrow/g) || [];
if (consumeMatches.length < 2) {
  throw new Error('Expected AI message quota to be consumed in both tutor and assignment follow-up actions.');
}
if (!aiSource.includes('requestedUserId && requestedUserId !== userId')) {
  throw new Error('Expected assignment follow-up to validate requested user id against authenticated user id.');
}

const topicChatPanelSource = await read('src/components/TopicChatPanel.jsx');
for (const pattern of [
  'api.subscriptions.getAiMessageQuotaStatus',
  'AI_MESSAGE_QUOTA_EXCEEDED',
  "reason: 'ai_message_limit'",
  'Upgrade to premium',
]) {
  if (!topicChatPanelSource.includes(pattern)) {
    throw new Error(`Expected TopicChatPanel.jsx to include "${pattern}" for AI message quota UX.`);
  }
}

const assignmentSource = await read('src/pages/AssignmentHelper.jsx');
for (const pattern of [
  "'AI_MESSAGE_QUOTA_EXCEEDED'",
  'buildAiMessageLimitSubscriptionPath',
  "reason: 'ai_message_limit'",
  'paywallMessage',
]) {
  if (!assignmentSource.includes(pattern)) {
    throw new Error(`Expected AssignmentHelper.jsx to include "${pattern}" for AI message quota handling.`);
  }
}

const subscriptionSource = await read('src/pages/Subscription.jsx');
if (!subscriptionSource.includes("reason === 'ai_message_limit'")) {
  throw new Error('Expected Subscription.jsx to handle reason === ai_message_limit.');
}

console.log('ai-message-quota-regression.test.mjs passed');
