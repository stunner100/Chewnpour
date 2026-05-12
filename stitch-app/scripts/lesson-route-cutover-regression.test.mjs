import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  fs.readFile(path.join(root, relativePath), 'utf8');

const appSource = await read('src/App.jsx');
const lessonsSource = await read('src/pages/LessonMemoryNeuralBasis.jsx');

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

requireIncludes(appSource, 'const RedirectLegacyLessonDetailRoute = () => {', 'App.jsx');
requireIncludes(appSource, 'const TopicDetailRoute = () => {', 'App.jsx');
requireIncludes(
  appSource,
  '<Route path="/dashboard/topic/:topicId" element={withSuspense(<TopicDetailRoute />)} />',
  'App.jsx',
);
requireIncludes(appSource, "const TopicDetail = lazyRoute(() => import('./pages/TopicDetail'), { componentName: 'TopicDetail', namedExport: 'TopicDetail' });", 'App.jsx');
requireIncludes(appSource, "<TopicDetail key={topicId || 'topic'} />", 'App.jsx');

requireExcludes(lessonsSource, 'const LessonDetailView = ({ topic }) => {', 'LessonMemoryNeuralBasis.jsx');
requireExcludes(lessonsSource, 'api.topics.getTopicWithQuestions', 'LessonMemoryNeuralBasis.jsx');
requireExcludes(lessonsSource, 'return <LessonDetailView topic={topicDetail} />;', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonsSource, 'to={`/dashboard/topic/${resumeTarget.topicId}`}', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonsSource, 'to={`/dashboard/topic/${topic._id}`}', 'LessonMemoryNeuralBasis.jsx');
requireExcludes(lessonsSource, "Navigate to={`/dashboard/topic/${lessonId}`}", 'LessonMemoryNeuralBasis.jsx');

console.log('lesson-route-cutover-regression.test.mjs passed');
