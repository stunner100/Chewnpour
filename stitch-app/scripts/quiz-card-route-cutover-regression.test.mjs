import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Expected ${label}: ${snippet}`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Unexpected ${label}: ${snippet}`);
  }
};

// The quiz list card links to the topic quiz player route (hard cutover to
// /dashboard/quiz/:topicId), not the old course action or Convex handlers.
const quizIndex = await read('src/pages/ActiveQuizSession.jsx');
requireIncludes(quizIndex, 'const quizReadyCourses = useMemo(', 'ActiveQuizSession.jsx');
requireIncludes(quizIndex, 'course.firstQuizTopicId || course.firstTopicId', 'ActiveQuizSession.jsx');
requireIncludes(quizIndex, 'to={`/dashboard/quiz/${encodeURIComponent(topic.topicId)}`}', 'ActiveQuizSession.jsx');
requireExcludes(quizIndex, "from 'convex/react'", 'ActiveQuizSession.jsx');
requireExcludes(quizIndex, '`/dashboard/course/${course._id}?action=quiz`', 'ActiveQuizSession.jsx');

// The topic quiz player itself must hit the REST API and be Convex-free.
const quizPlayer = await read('src/pages/TopicQuizPlayer.jsx');
requireIncludes(quizPlayer, '/api/topics/${encodeURIComponent(topicId)}/quiz', 'TopicQuizPlayer.jsx');
requireExcludes(quizPlayer, "from 'convex/react'", 'TopicQuizPlayer.jsx');

console.log('quiz-card-route-cutover-regression.test.mjs passed');
