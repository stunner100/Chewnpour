import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const examsSource = await fs.readFile(path.join(root, 'convex', 'exams.ts'), 'utf8');
if (!/isUsableExamQuestion/.test(examsSource)) {
  throw new Error('Expected exams.ts to import/use isUsableExamQuestion.');
}
if (!/const\s+usableQuestions\s*=\s*filteredQuestions\.filter\(\(question\)\s*=>\s*[\s\S]*isUsableExamQuestion\(question,\s*\{\s*allowEssay:\s*isEssay\s*\}\)\s*[\s\S]*\);/.test(examsSource)) {
  throw new Error('Expected exams.ts to filter topic questions by quality before selecting exam questions.');
}
if (!/generateQuestionsForTopicInternal/.test(examsSource)) {
  throw new Error('Expected exams.ts to schedule question regeneration when no usable questions exist.');
}
if (!/Questions are being refreshed for quality\. Please try again in a few seconds\./.test(examsSource)) {
  throw new Error('Expected exams.ts to return a quality-refresh message when usable questions are unavailable.');
}

const topicsSource = await fs.readFile(path.join(root, 'convex', 'topics.ts'), 'utf8');
if (!/filter\(\(question\)\s*=>\s*isUsableExamQuestion\(question\)\)/.test(topicsSource)) {
  throw new Error('Expected topics.ts queries to filter out unusable questions.');
}

const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');
if (!/const\s+rawExistingQuestions\s*=\s*topicWithQuestions\.questions\s*\|\|\s*\[\];/.test(aiSource)) {
  throw new Error('Expected ai.ts question-bank generation to inspect raw existing questions.');
}
if (!/const\s+existingQuestions\s*=\s*rawExistingQuestions\.filter/.test(aiSource)) {
  throw new Error('Expected ai.ts question-bank generation to derive existingQuestions from quality-filtered records.');
}
if (!/return\s+hasUsableQuestionOptions\(options\);/.test(aiSource)) {
  throw new Error('Expected ai.ts to count only usable existing question options toward generation targets.');
}

console.log('exam-question-quality-gate-regression.test.mjs passed');
