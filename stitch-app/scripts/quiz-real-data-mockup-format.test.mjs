import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const quizSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'ActiveQuizSession.jsx'),
  'utf8',
);

for (const expectedSnippet of [
  'const QuizMockupPanel',
  'api.courses.getCourseWithTopics',
  'api.topics.getTopicWithQuestions',
  'Array.isArray(options.choices)',
  'parseOptionJson',
  'Sample question',
  'Objective review',
  'Start quiz',
  'FRESH_OBJECTIVE_QUIZ_DISPLAY_COUNT',
  'resolveObjectiveAttemptQuestionCount',
  'Fresh {attemptQuestionCount}-question quiz',
  'Starts a fresh {attemptQuestionCount}-question attempt from this topic.',
  "topic${quizzesReady === 1 ? '' : 's'} ready",
]) {
  if (!quizSource.includes(expectedSnippet)) {
    throw new Error(`Expected quiz page to keep mockup-style real-data format (${expectedSnippet}).`);
  }
}

for (const forbiddenSnippet of [
  'Practice from your generated topics',
  'Continue practice',
  'Start an objective quiz from the topic you last studied.',
  '/dashboard/exam',
  '<Navigate',
  '{totalQuestions} generated question',
  "quiz${quizzesReady === 1 ? '' : 'zes'} ready",
]) {
  if (quizSource.includes(forbiddenSnippet)) {
    throw new Error(`Quiz page reintroduced list/resume copy instead of the mockup format (${forbiddenSnippet}).`);
  }
}

console.log('quiz-real-data-mockup-format.test.mjs passed');
