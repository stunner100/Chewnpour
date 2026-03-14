import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'convex', 'schema.ts');
const aiPath = path.join(root, 'convex', 'ai.ts');
const adminPath = path.join(root, 'convex', 'admin.ts');
const dashboardPath = path.join(root, 'src', 'pages', 'AdminDashboard.jsx');

const [schemaSource, aiSource, adminSource, dashboardSource] = await Promise.all([
  fs.readFile(schemaPath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
  fs.readFile(adminPath, 'utf8'),
  fs.readFile(dashboardPath, 'utf8'),
]);

for (const snippet of [
  'llmUsageDaily: defineTable({',
  'requestCount: v.number(),',
  'promptTokens: v.number(),',
  'completionTokens: v.number(),',
  'totalTokens: v.number(),',
  '.index("by_userId_date", ["userId", "date"])',
]) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`Expected schema.ts to include "${snippet}" for LLM usage tracking.`);
  }
}

for (const snippet of [
  'runMutation((internal as any).llmUsage.recordUsageInternal',
  '"course_generation"',
  '"assignment_processing"',
  '"topic_tutor"',
  '"mcq_generation"',
  '"essay_generation"',
  '"exam_feedback"',
  '"re_explain"',
  '"humanize_verification"',
]) {
  if (!aiSource.includes(snippet)) {
    throw new Error(`Expected ai.ts to include "${snippet}" for LLM usage attribution.`);
  }
}

for (const snippet of [
  'ctx.db.query("llmUsageDaily").collect()',
  'const llmUsageByUser = new Map<string, {',
  'llmTokensTotal',
  'llmTokensLastWindow',
  'llmUsageAnalytics: {',
  'promptTokensTotal:',
  'completionTokensTotal:',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for admin LLM usage aggregation.`);
  }
}

for (const snippet of [
  'label={`LLM tokens (${activeUsersDays}d)`}',
  'const llmUsage = snapshot.llmUsageAnalytics || {};',
  'SectionCard title="LLM Usage"',
  'LLM tokens',
]) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for LLM usage visibility.`);
  }
}

console.log('admin-llm-usage-regression.test.mjs passed');
