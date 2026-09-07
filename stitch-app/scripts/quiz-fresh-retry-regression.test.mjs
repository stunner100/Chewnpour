import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuestionsForTopic } from '../server/courseGeneration.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const content = [
  'Working memory holds a small amount of information while you use it.',
  'Long-term memory stores knowledge for later retrieval.',
  'Attention selects what enters working memory.',
  'Chunking can increase how much you hold at once.',
  'Interference happens when similar items compete.',
].join(' ');

const first = buildQuestionsForTopic({
  topicTitle: 'Working Memory',
  topicContent: content,
  limit: 3,
});
const excludeCorrect = first.map((question) => question.options[question.correctIndex]);
const retry = buildQuestionsForTopic({
  topicTitle: 'Working Memory',
  topicContent: content,
  limit: 3,
  offset: first.length,
  excludeCorrect,
});

assert.ok(first.length > 0, 'initial quiz must generate questions');
assert.ok(retry.length > 0, 'retry quiz must generate questions');
assert.notDeepEqual(
  retry.map((question) => question.options[question.correctIndex]),
  first.map((question) => question.options[question.correctIndex]),
  'retry must not reuse the previous correct sentences',
);

const courses = read('server/courses.js');
const http = read('server/courseHttp.js');
const player = read('src/pages/TopicQuizPlayer.jsx');
const results = read('src/pages/DashboardResults.jsx');

assert.match(courses, /export const regenerateQuizForTopic/, 'server must expose quiz regeneration');
assert.match(courses, /DELETE FROM questions[\s\S]*AND \$\{MCQ_TYPE_SQL\}/, 'regeneration must keep in-lesson checks');
assert.match(http, /parts\[2\] === "regenerate"/, 'HTTP must expose POST /quiz/regenerate');
assert.match(player, /quiz\/regenerate/, 'quiz player must request a fresh set');
assert.match(results, /Retry with new questions/, 'results must not claim a same-question retry');
assert.doesNotMatch(results, /Try the essay/, 'results must not advertise an essay flow');

console.log('quiz-fresh-retry-regression.test.mjs passed');
