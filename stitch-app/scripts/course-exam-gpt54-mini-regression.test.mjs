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
assert.ok(
  aiSource.includes('const HARD_CUTOVER_OPENAI_FEATURES = new Set([')
    && aiSource.includes('"course_generation"'),
  'Expected ai.ts to keep course generation hard-cutover on the GPT-5.4 mini path.'
);
assert.ok(
  !aiSource.includes('const HARD_CUTOVER_OPENAI_FEATURES = new Set([\n    "course_generation",\n    "essay_generation",')
    && !aiSource.includes('const HARD_CUTOVER_OPENAI_FEATURES = new Set([\r\n    "course_generation",\r\n    "essay_generation",'),
  'Expected essay generation to be removed from the hard-cutover OpenAI set so it can fall back.'
);
assert.ok(
  aiSource.includes('const OPENAI_PRIMARY_FEATURES = new Set([')
    && aiSource.includes('"essay_generation"'),
  'Expected essay generation to stay OpenAI-primary even though it is no longer hard-cutover.'
);
assert.ok(
  aiSource.includes('const OPENAI_PIPELINE_MODEL_FEATURES = new Set([')
    && aiSource.includes('const pipelineOpenAiPreferred = featureUsesOpenAiPipelineModel(llmFeature);')
    && aiSource.includes('const openAiModel = pipelineOpenAiPreferred ? OPENAI_PIPELINE_MODEL : model;')
    && aiSource.includes('OPENAI_API_KEY environment variable not set for the GPT-5.4 mini pipeline.'),
  'Expected ai.ts to keep the GPT-5.4 mini model preference for course and essay generation without forcing essay hard-cutover.'
);
assert.ok(
  envSource.includes('OPENAI_PIPELINE_MODEL=gpt-5.4-mini'),
  'Expected .env.example to document the GPT-5.4 mini pipeline model setting.'
);

console.log('course-exam-gpt54-mini-regression.test.mjs passed');
