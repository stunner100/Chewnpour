import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const topicDetailSource = await fs.readFile(path.join(root, 'src/pages/TopicDetail.jsx'), 'utf8');
const useTopicDetailSource = await fs.readFile(path.join(root, 'src/hooks/useTopicDetail.js'), 'utf8');
const contentPanelSource = await fs.readFile(
  path.join(root, 'src/components/topic/TopicContentPanel.jsx'),
  'utf8',
);

if (!useTopicDetailSource.includes('const podcastEnabled = true')) {
  throw new Error('Expected useTopicDetail to enable the lesson podcast surface.');
}

if (!contentPanelSource.includes('LessonPodcastCard')) {
  throw new Error('Expected TopicContentPanel to mount LessonPodcastCard.');
}

if (topicDetailSource.includes('LessonPodcastCard') || topicDetailSource.includes('TopicPodcastPanel')) {
  throw new Error('Expected TopicDetail to keep podcast UI in TopicContentPanel, not the page shell.');
}

for (const forbiddenSnippet of [
  "import TopicVideoPanel from '../components/TopicVideoPanel';",
  "import.meta.env.VITE_VIDEO_GEN_ENABLED === 'true' && topicId",
  '<TopicVideoPanel topicId={topicId} />',
]) {
  if (topicDetailSource.includes(forbiddenSnippet) || useTopicDetailSource.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: video surface should not appear in topic lesson: ${forbiddenSnippet}`);
  }
}

console.log('topic-media-surface-regression.test.mjs passed');
