import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const quizSource = await fs.readFile(path.join(root, 'src/pages/ActiveQuizSession.jsx'), 'utf8');

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

requireIncludes(quizSource, 'const quizReadyCourses = useMemo(', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'course.firstQuizTopicId || course.firstTopicId', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'to={`/dashboard/quiz/${encodeURIComponent(targetTopicId)}`}', 'ActiveQuizSession.jsx');
requireExcludes(quizSource, "from 'convex/react'", 'ActiveQuizSession.jsx');
requireExcludes(quizSource, '`/dashboard/course/${course._id}?action=quiz`', 'ActiveQuizSession.jsx');

console.log('quiz-card-route-cutover-regression.test.mjs passed');
