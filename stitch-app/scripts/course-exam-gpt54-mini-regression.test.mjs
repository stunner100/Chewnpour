import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const envPath = resolve(rootDir, '.env.example');

const aiSource = readFileSync(aiPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');

assert.ok(
  aiSource.includes('const OPENAI_PIPELINE_MODEL = String(process.env.OPENAI_PIPELINE_MODEL || "gpt-5.4-mini").trim() || "gpt-5.4-mini";'),
  'Expected ai.ts to pin the course and exam pipeline model to GPT-5.4 mini.'
);

const hardCutoverMatch = aiSource.match(
  /const HARD_CUTOVER_OPENAI_FEATURES = new Set\(\[([\s\S]*?)\]\);/
);
assert.ok(
  hardCutoverMatch,
  'Expected ai.ts to define HARD_CUTOVER_OPENAI_FEATURES.'
);

const hardCutoverBlock = String(hardCutoverMatch?.[1] || '');
assert.ok(
  hardCutoverBlock.includes('"course_generation"')
    && !hardCutoverBlock.includes('"mcq_generation"')
    && !hardCutoverBlock.includes('"essay_generation"'),
  'Expected ai.ts to keep only course_generation on hard-cut GPT-5.4 mini.'
);
assert.ok(
  aiSource.includes('const openAiModel = pipelineOpenAiRequired ? OPENAI_PIPELINE_MODEL : model;')
    && aiSource.includes('OPENAI_API_KEY environment variable not set for the GPT-5.4 mini pipeline.'),
  'Expected ai.ts to force GPT-5.4 mini for hard-cut pipeline features.'
);
assert.ok(
  envSource.includes('OPENAI_PIPELINE_MODEL=gpt-5.4-mini'),
  'Expected .env.example to document the GPT-5.4 mini pipeline model setting.'
);

console.log('course-exam-gpt54-mini-regression.test.mjs passed');
