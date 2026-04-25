import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const topicDetailSource = await fs.readFile(path.join(root, 'src/pages/TopicDetail.jsx'), 'utf8');

for (const snippet of [
  "import TopicPodcastPanel from '../components/TopicPodcastPanel';",
  "import.meta.env.VITE_PODCAST_GEN_ENABLED === 'true' && topicId",
  '<TopicPodcastPanel topicId={topicId} />',
]) {
  if (!topicDetailSource.includes(snippet)) {
    throw new Error(`Regression detected: podcast surface missing snippet: ${snippet}`);
  }
}

for (const forbiddenSnippet of [
  "import TopicVideoPanel from '../components/TopicVideoPanel';",
  "import.meta.env.VITE_VIDEO_GEN_ENABLED === 'true' && topicId",
  '<TopicVideoPanel topicId={topicId} />',
]) {
  if (topicDetailSource.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: video surface should not appear in TopicDetail: ${forbiddenSnippet}`);
  }
}

console.log('topic-media-surface-regression.test.mjs passed');
