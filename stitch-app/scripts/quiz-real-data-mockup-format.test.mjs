import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

// The topic quiz player renders real question data from the REST API — the
// prompt, the plain-string options array, and the answer map — not a mock.
const quizPlayer = await read('src/pages/TopicQuizPlayer.jsx');

for (const expectedSnippet of [
  '/api/topics/${encodeURIComponent(topicId)}/quiz',
  'Array.isArray(quiz?.questions)',
  'answers[question.id]',
  'questionId: question.id',
]) {
  if (!quizPlayer.includes(expectedSnippet)) {
    throw new Error(`Expected quiz player to render real question data (${expectedSnippet}).`);
  }
}

for (const forbiddenSnippet of [
  "from 'convex/react'",
  'api.topics.getTopicWithQuestions',
  'Sample question',
  'Lorem ipsum',
]) {
  if (quizPlayer.includes(forbiddenSnippet)) {
    throw new Error(`Quiz player reintroduced mock/Convex data (${forbiddenSnippet}).`);
  }
}

// The single-question component renders the real prompt and option list.
const quizQuestion = await read('src/components/quiz/QuizQuestion.jsx');
for (const expectedSnippet of ['question?.prompt', 'question.id', 'option']) {
  if (!quizQuestion.includes(expectedSnippet)) {
    throw new Error(`Expected QuizQuestion to render real options (${expectedSnippet}).`);
  }
}

console.log('quiz-real-data-mockup-format.test.mjs passed');
