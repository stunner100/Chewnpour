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

requireIncludes(appSource, 'const RedirectLegacyLessonRoute = () => {', 'App.jsx');
requireIncludes(
  appSource,
  '<Route path="/dashboard/topic/:topicId" element={<RedirectLegacyLessonRoute />} />',
  'App.jsx',
);
requireExcludes(appSource, "const TopicDetail = lazyRoute", 'App.jsx');
requireExcludes(appSource, '<TopicDetail />', 'App.jsx');

requireIncludes(lessonsSource, 'const LessonDetailView = ({ topic }) => {', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonsSource, 'api.topics.getTopicWithQuestions', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonsSource, 'return <LessonDetailView topic={topicDetail} />;', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonsSource, 'to={`/dashboard/lessons/${resumeTarget.topicId}`}', 'LessonMemoryNeuralBasis.jsx');
requireIncludes(lessonsSource, 'to={`/dashboard/lessons/${topic._id}`}', 'LessonMemoryNeuralBasis.jsx');
requireExcludes(lessonsSource, "Navigate to={`/dashboard/topic/${lessonId}`}", 'LessonMemoryNeuralBasis.jsx');
requireExcludes(lessonsSource, 'to={`/dashboard/topic/${resumeTarget.topicId}`}', 'LessonMemoryNeuralBasis.jsx');

console.log('lesson-route-cutover-regression.test.mjs passed');
