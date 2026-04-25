import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const schemaSource = await fs.readFile(path.join(root, 'convex/schema.ts'), 'utf8');

for (const snippet of [
  'topics: defineTable({',
  'redundancyRiskScore: v.optional(v.number()),',
  'strongestNeighborOverlap: v.optional(v.number()),',
  'supportedQuestionTypes: v.optional(v.array(v.string())),',
  'sourceChunkIds: v.optional(v.array(v.number())),',
]) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`Regression detected: topics schema compatibility missing snippet: ${snippet}`);
  }
}

console.log('topic-schema-compat-regression.test.mjs passed');
