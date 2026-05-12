import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [lessonSource, quizSource] = await Promise.all([
  read('src/pages/LessonMemoryNeuralBasis.jsx'),
  read('src/pages/ActiveQuizSession.jsx'),
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

requireIncludes(lessonSource, 'const hasLessonContent = (course) =>', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonSource, 'const shouldShowLessonCourse = (course) =>', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonSource, 'const visibleLessonCourses = useMemo(() => courseList.filter(shouldShowLessonCourse), [courseList]);', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonSource, 'visibleLessonCourses.map((course)', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonSource, 'Lessons are still preparing', 'LessonMemoryNeuralBasis.jsx');
requireExcludes(lessonSource, 'courseList.map((course) => (', 'LessonMemoryNeuralBasis.jsx');

requireIncludes(quizSource, 'const hasQuizContent = (course) =>', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'const shouldShowQuizCourse = (course) =>', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'const quizReadyCourses = useMemo(() => courseList.filter(hasQuizContent), [courseList]);', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'const visibleQuizCourses = useMemo(() => courseList.filter(shouldShowQuizCourse), [courseList]);', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'visibleQuizCourses.map((course)', 'ActiveQuizSession.jsx');
requireIncludes(quizSource, 'resumeQuizReady ? resumeTarget : null', 'ActiveQuizSession.jsx');
requireExcludes(quizSource, 'courseList.map((course)', 'ActiveQuizSession.jsx');
requireExcludes(quizSource, 'const targetTopicId = course.firstQuizTopicId || course.firstTopicId;', 'ActiveQuizSession.jsx');

console.log('study-tool-card-content-gates-regression.test.mjs passed');
