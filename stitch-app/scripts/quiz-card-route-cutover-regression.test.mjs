import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [quizSource, coursesSource] = await Promise.all([
  read('src/pages/ActiveQuizSession.jsx'),
  read('convex/courses.ts'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`${label} should not include "${snippet}".`);
  }
};

requireIncludes(quizSource, 'const hasQuizContent = (course) =>', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'const targetTopicId = course.firstQuizTopicId;', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'if (!targetTopicId || quizzesReady <= 0) return null;', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'to={buildObjectiveExamRoute(targetTopicId)}', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'const quizReadyCourses = useMemo(() => courseList.filter(hasQuizContent), [courseList]);', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'quizReadyCourses.slice(0, 4).map((course)', 'ActiveQuizSession.jsx');
requireExcludes(quizSource, '`/dashboard/course/${course._id}?action=quiz`', 'ActiveQuizSession.jsx');
requireExcludes(quizSource, ': `/dashboard/lessons?courseId=${course._id}`;', 'ActiveQuizSession.jsx');
requireExcludes(quizSource, ': `/dashboard/quiz?courseId=${course._id}`;', 'ActiveQuizSession.jsx');

requireIncludes(coursesSource, 'quizzesReady: quizReadyTopics.length', 'convex/courses.ts');
requireIncludes(coursesSource, 'firstTopicId: firstTopic?._id ?? null', 'convex/courses.ts');
requireIncludes(coursesSource, 'firstQuizTopicId: firstQuizTopic?._id ?? null', 'convex/courses.ts');

console.log('quiz-card-route-cutover-regression.test.mjs passed');
