import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const appSource = await fs.readFile(
  path.join(process.cwd(), 'src', 'App.jsx'),
  'utf8',
);

const resultsRoute = '<Route path="/dashboard/quiz/results/:attemptId"';
const topicRoute = '<Route path="/dashboard/quiz/:topicId"';
const indexRoute = '<Route path="/dashboard/quiz"';

const resultsIndex = appSource.indexOf(resultsRoute);
const topicIndex = appSource.indexOf(topicRoute);
const indexIndex = appSource.indexOf(indexRoute);

if (resultsIndex === -1 || topicIndex === -1 || indexIndex === -1) {
  throw new Error('Expected dashboard quiz index, topic, and results routes to be defined.');
}

if (!(resultsIndex < topicIndex && topicIndex < indexIndex)) {
  throw new Error('Expected specific quiz routes to be defined before the quiz index route.');
}

console.log('quiz-topic-route-priority-regression.test.mjs passed');
