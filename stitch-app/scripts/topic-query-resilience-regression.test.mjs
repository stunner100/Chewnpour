import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const topicsSource = await fs.readFile(path.join(root, 'convex', 'topics.ts'), 'utf8');

if (!/const safeGetDocument = async \(id: any\) => \{[\s\S]*?ctx\.db\.get\(id\)[\s\S]*?catch \{[\s\S]*?return null;/m.test(topicsSource)) {
  throw new Error('Expected getTopicWithQuestionsPayload to guard db.get lookups with safeGetDocument.');
}

if (!/let questions: any\[] = \[];[\s\S]*?try \{[\s\S]*?\.query\("questions"\)[\s\S]*?\.collect\(\)[\s\S]*?\} catch \{[\s\S]*?questions = \[];/m.test(topicsSource)) {
  throw new Error('Expected getTopicWithQuestionsPayload to guard question hydration errors.');
}

const publicTopicQueryMatch = topicsSource.match(
  /export const getTopicWithQuestions = query\(\{[\s\S]*?\n\}\);/m,
);
if (!publicTopicQueryMatch) {
  throw new Error('Public getTopicWithQuestions query not found.');
}
const publicTopicQuerySource = publicTopicQueryMatch[0];

if (!/const identity = await ctx\.auth\.getUserIdentity\(\);/.test(publicTopicQuerySource)) {
  throw new Error('Expected getTopicWithQuestions to resolve auth identity.');
}

if (!/if \(!authUserId\) return null;/.test(publicTopicQuerySource)) {
  throw new Error('Expected unauthenticated getTopicWithQuestions calls to return null.');
}

if (!/assertAuthorizedUser\(\{\s*authUserId,\s*resourceOwnerUserId: payload\.ownerUserId,\s*\}\);/s.test(publicTopicQuerySource)) {
  throw new Error('Expected getTopicWithQuestions to enforce ownership checks.');
}

if (!/try \{[\s\S]*assertAuthorizedUser\([\s\S]*\);[\s\S]*\} catch \{[\s\S]*return null;/s.test(publicTopicQuerySource)) {
  throw new Error('Expected ownership failures to return null instead of throwing.');
}

console.log('topic-query-resilience-regression.test.mjs passed');
