import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { normalizeAiCoursePayload } from '../server/aiCourseGeneration.js';

const root = process.cwd();

const llmClient = await fs.readFile(path.join(root, 'server', 'llmClient.js'), 'utf8');
if (!/export const callCourseLlmChat/.test(llmClient) || !/export const isCourseAiEnabled/.test(llmClient)) {
  throw new Error('Expected server/llmClient.js to expose course LLM chat helpers.');
}

const aiCourse = await fs.readFile(path.join(root, 'server', 'aiCourseGeneration.js'), 'utf8');
if (!/generateCourseCurriculumWithAi/.test(aiCourse) || !/normalizeAiCoursePayload/.test(aiCourse)) {
  throw new Error('Expected server/aiCourseGeneration.js to expose AI curriculum helpers.');
}
if (!/generateOutline/.test(aiCourse) || !/mapWithConcurrency/.test(aiCourse) || !/sliceSourceForTopic/.test(aiCourse)) {
  throw new Error('Expected outline-then-parallel topic generation.');
}

const courses = await fs.readFile(path.join(root, 'server', 'courses.js'), 'utf8');
if (!/generateCourseCurriculumWithAi/.test(courses) || !/generation_backend/.test(courses)) {
  throw new Error('Expected ensureCourseFromUpload to persist AI generation backend.');
}

const migration = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724124000_course_generation_backend.sql'),
  'utf8',
);
if (!/generation_backend/.test(migration)) {
  throw new Error('Expected migration to add courses.generation_backend.');
}

const envExample = await fs.readFile(path.join(root, '.env.example'), 'utf8');
if (!/COURSE_AI_ENABLED=/.test(envExample) || !/DEEPSEEK_API_KEY=/.test(envExample)) {
  throw new Error('Expected .env.example to document COURSE_AI / DeepSeek settings.');
}

const normalized = normalizeAiCoursePayload(
  {
    topics: [
      {
        title: 'Memory systems',
        description: 'Working and long-term memory',
        content:
          'Working memory holds information briefly while long-term memory stores durable knowledge for later retrieval in study sessions.',
        questions: [
          {
            prompt: 'What does working memory do?',
            options: [
              'Holds information briefly',
              'Stores only motor skills forever',
              'Deletes long-term memories',
              'Blocks attention entirely',
            ],
            correctIndex: 0,
            explanation: 'Working memory is short-term and active.',
          },
        ],
      },
    ],
  },
  { fileName: 'memory.pdf', extractedText: 'fallback' },
);

if (normalized.backend !== 'deepseek' || normalized.topics.length !== 1) {
  throw new Error('Expected normalizeAiCoursePayload to accept a valid AI curriculum.');
}
if (normalized.topics[0].questions.length < 1) {
  throw new Error('Expected normalized topic to keep AI questions.');
}

const invalidFallback = normalizeAiCoursePayload(
  { topics: [{ title: 'x', content: 'too short' }] },
  {
    fileName: 'memory.pdf',
    extractedText:
      '# Memory\n\nWorking memory holds information briefly for active reasoning.\n\n## Long-term memory\n\nLong-term memory stores durable knowledge for later retrieval during exams and practice.',
  },
);
if (!invalidFallback.topics.length) {
  throw new Error('Expected invalid AI payload to fall back to heuristic topics.');
}

console.log('supabase-ai-course-generation-regression.test.mjs passed');
