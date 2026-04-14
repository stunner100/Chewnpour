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
    && aiSource.includes('"course_generation"')
    && aiSource.includes('"mcq_generation"')
    && aiSource.includes('"essay_generation"'),
  'Expected ai.ts to hard-cut course and exam generation features onto the OpenAI GPT-5.4 mini path.'
);
assert.ok(
  aiSource.includes('const openAiModel = pipelineOpenAiRequired ? OPENAI_PIPELINE_MODEL : model;')
    && aiSource.includes('OPENAI_API_KEY environment variable not set for the GPT-5.4 mini pipeline.'),
  'Expected ai.ts to force GPT-5.4 mini for course and exam generation instead of silently falling back.'
);
assert.ok(
  envSource.includes('OPENAI_PIPELINE_MODEL=gpt-5.4-mini'),
  'Expected .env.example to document the GPT-5.4 mini pipeline model setting.'
);

console.log('course-exam-gpt54-mini-regression.test.mjs passed');
