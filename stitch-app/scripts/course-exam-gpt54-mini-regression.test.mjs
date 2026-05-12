import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const envPath = resolve(rootDir, '.env.example');

const aiSource = readFileSync(aiPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');
const complexFeatureSet = aiSource.match(/const COMPLEX_DOCUMENT_PIPELINE_FEATURES = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';

assert.ok(
  aiSource.includes('const DEEPSEEK_DOCUMENT_FLASH_MODEL = String(process.env.DEEPSEEK_DOCUMENT_FLASH_MODEL || "deepseek-v4-flash").trim() || "deepseek-v4-flash";')
    && aiSource.includes('const DEEPSEEK_DOCUMENT_PRO_MODEL = String(process.env.DEEPSEEK_DOCUMENT_PRO_MODEL || "deepseek-v4-pro").trim() || "deepseek-v4-pro";'),
  'Expected ai.ts to pin the document pipeline to DeepSeek V4 Flash and Pro models.'
);
assert.ok(
  aiSource.includes('const DEEPSEEK_DOCUMENT_PIPELINE_FEATURES = new Set([')
    && aiSource.includes('"course_generation"')
    && aiSource.includes('"mcq_generation"')
    && aiSource.includes('"essay_generation"'),
  'Expected ai.ts to hard-cut course and exam generation features onto the DeepSeek document pipeline.'
);
assert.ok(
  aiSource.includes('const COMPLEX_DOCUMENT_PIPELINE_FEATURES = new Set([')
    && !complexFeatureSet.includes('"mcq_generation"')
    && complexFeatureSet.includes('"essay_generation"')
    && aiSource.includes('const openAiModel = pipelineOpenAiRequired ? resolveDeepSeekDocumentPipelineModel(llmFeature) : model;')
    && aiSource.includes('const DEEPSEEK_DOCUMENT_PRO_MIN_MAX_TOKENS = Number(process.env.DEEPSEEK_DOCUMENT_PRO_MIN_MAX_TOKENS || 8192);')
    && aiSource.includes('Math.max(requestedOpenAiMaxTokens, DEEPSEEK_DOCUMENT_PRO_MIN_MAX_TOKENS)')
    && aiSource.includes('DEEPSEEK_API_KEY environment variable not set for the DeepSeek document pipeline.'),
  'Expected ai.ts to force normal course/MCQ generation through DeepSeek Flash and reserve DeepSeek Pro for complex generation with a reasoning-safe token budget.'
);
assert.ok(
  envSource.includes('DEEPSEEK_DOCUMENT_FLASH_MODEL=deepseek-v4-flash')
    && envSource.includes('DEEPSEEK_DOCUMENT_PRO_MODEL=deepseek-v4-pro')
    && envSource.includes('DEEPSEEK_DOCUMENT_PRO_MIN_MAX_TOKENS=8192'),
  'Expected .env.example to document the DeepSeek document model settings.'
);

assert.ok(
  aiSource.includes('maxTokens: 5200')
    && aiSource.includes('maxTokens: 2600')
    && aiSource.includes('maxTokens: 3000'),
  'Expected normal-doc question generation to reserve enough response tokens for cited JSON batches.'
);

console.log('course-exam-deepseek-regression.test.mjs passed');
