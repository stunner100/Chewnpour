import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const envPath = resolve(rootDir, '.env.example');

const aiSource = readFileSync(aiPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');

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
    && aiSource.includes('const openAiModel = pipelineOpenAiRequired ? resolveDeepSeekDocumentPipelineModel(llmFeature) : model;')
    && aiSource.includes('DEEPSEEK_API_KEY environment variable not set for the DeepSeek document pipeline.'),
  'Expected ai.ts to force DeepSeek Flash for normal docs and DeepSeek Pro for complex docs instead of silently falling back.'
);
assert.ok(
  envSource.includes('DEEPSEEK_DOCUMENT_FLASH_MODEL=deepseek-v4-flash')
    && envSource.includes('DEEPSEEK_DOCUMENT_PRO_MODEL=deepseek-v4-pro'),
  'Expected .env.example to document the DeepSeek document model settings.'
);

console.log('course-exam-deepseek-regression.test.mjs passed');
