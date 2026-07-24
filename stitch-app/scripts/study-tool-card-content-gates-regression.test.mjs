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
requireIncludes(quizSource, 'Boolean(course.firstQuizTopicId) || Number(course.quizzesReady || 0) > 0', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'quizReadyCourses.slice(0, 8).map((course)', 'ActiveQuizSession.jsx');
requireExcludes(quizSource, "from 'convex/react'", 'ActiveQuizSession.jsx');
requireExcludes(quizSource, 'courseList.slice(0, 4).map((course)', 'ActiveQuizSession.jsx');

console.log('study-tool-card-content-gates-regression.test.mjs passed');
