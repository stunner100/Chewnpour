import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const migration = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724123000_courses_topics_quizzes.sql'),
  'utf8',
);
for (const table of ['"courses"', '"topics"', '"questions"', '"quiz_attempts"']) {
  if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    throw new Error(`Expected courses migration to create ${table}.`);
  }
}

const coursesSource = await fs.readFile(path.join(root, 'server', 'courses.js'), 'utf8');
for (const symbol of [
  'ensureCourseFromUpload',
  'listCoursesForUser',
  'getCourseForUser',
  'getQuizForTopic',
  'submitQuizAttempt',
]) {
  if (!coursesSource.includes(`export const ${symbol}`)) {
    throw new Error(`Expected server/courses.js to export ${symbol}.`);
  }
}
if (!/generateCourseCurriculumWithAi/.test(coursesSource) || !/generation_backend/.test(coursesSource)) {
  throw new Error('Expected courses creation to use AI curriculum generation.');
}

const courseHttp = await fs.readFile(path.join(root, 'server', 'courseHttp.js'), 'utf8');
if (!/handleCoursesRequest/.test(courseHttp) || !/handleTopicsRequest/.test(courseHttp)) {
  throw new Error('Expected course HTTP handlers for courses and topics.');
}

const library = await fs.readFile(path.join(root, 'src', 'pages', 'MyMaterialsLibrary.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(library)) {
  throw new Error('Expected MyMaterialsLibrary to stop depending on Convex.');
}
if (!/\/api\/courses/.test(library) || !/\/api\/uploads/.test(library)) {
  throw new Error('Expected MyMaterialsLibrary to load Supabase courses and uploads.');
}

const lessons = await fs.readFile(path.join(root, 'src', 'pages', 'LessonMemoryNeuralBasis.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(lessons) || !/\/api\/courses/.test(lessons)) {
  throw new Error('Expected lessons page to use /api/courses.');
}

const quizHub = await fs.readFile(path.join(root, 'src', 'pages', 'ActiveQuizSession.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(quizHub) || !/firstQuizTopicId/.test(quizHub)) {
  throw new Error('Expected quiz hub to use Supabase course quiz metadata.');
}

const quizPlayer = await fs.readFile(path.join(root, 'src', 'pages', 'TopicQuizPlayer.jsx'), 'utf8');
if (!/\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/quiz/.test(quizPlayer)) {
  throw new Error('Expected TopicQuizPlayer to call the topics quiz API.');
}

const appSource = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');
if (!/pages\/TopicQuizPlayer/.test(appSource)) {
  throw new Error('Expected App.jsx quiz route to use TopicQuizPlayer.');
}

const viteConfig = await fs.readFile(path.join(root, 'vite.config.js'), 'utf8');
if (!/['"]\/api\/courses['"]/.test(viteConfig) || !/['"]\/api\/topics['"]/.test(viteConfig)) {
  throw new Error('Expected Vite to proxy /api/courses and /api/topics.');
}

console.log('supabase-courses-milestone-regression.test.mjs passed');
