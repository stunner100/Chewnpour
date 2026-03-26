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
if (!/status:\s*"needs_generation"/.test(examsSource)) {
  throw new Error('Expected exams.ts to return a structured needs_generation status when a prepared exam is not ready yet.');
}

const preparationsSource = await fs.readFile(path.join(root, 'convex', 'examPreparations.ts'), 'utf8');
if (!/generateQuestionsForTopicOnDemandInternal/.test(preparationsSource) || !/generateEssayQuestionsForTopicOnDemandInternal/.test(preparationsSource)) {
  throw new Error('Expected examPreparations.ts to trigger on-demand regeneration when a full usable exam set is not available.');
}

const topicsSource = await fs.readFile(path.join(root, 'convex', 'topics.ts'), 'utf8');
if (!/const computeTopicExamReadinessFromQuestions = \(/.test(topicsSource)) {
  throw new Error('Expected topics.ts to centralize exam readiness computation.');
}
if (!/isUsableExamQuestion\(question\)/.test(topicsSource) || !/isUsableExamQuestion\(question,\s*\{\s*allowEssay:\s*true\s*\}\)/.test(topicsSource)) {
  throw new Error('Expected topics.ts readiness computation to distinguish usable MCQ and essay questions.');
}

const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');
if (!/filterQuestionsForActiveAssessment\(/.test(aiSource)) {
  throw new Error('Expected ai.ts question-bank generation to inspect active assessment questions.');
}
if (!/return\s+hasUsableQuestionOptions\(options\);/.test(aiSource)) {
  throw new Error('Expected ai.ts to count only usable existing question options toward generation targets.');
}
if (!/applyGroundedAcceptance\(\{[\s\S]*type:\s*"mcq"/.test(aiSource)) {
  throw new Error('Expected ai.ts MCQ generation to apply grounded acceptance checks.');
}
if (!/createQuestionInternal,\s*\{[\s\S]*citations,[\s\S]*groundingScore:[\s\S]*factualityStatus:/.test(aiSource)) {
  throw new Error('Expected ai.ts MCQ persistence to include grounding metadata.');
}

console.log('exam-question-quality-gate-regression.test.mjs passed');
