import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const topicDetailSource = await fs.readFile(path.join(root, 'src/pages/TopicDetail.jsx'), 'utf8');

for (const snippet of [
  "import.meta.env.VITE_PODCAST_GEN_ENABLED === 'true' && topicId",
  "podcastEnabled && {\n            id: 'podcast-rail'",
  "podcastEnabled && { id: 'p-podcast'",
  "topicProgress?.completedAt\n            ? podcastEnabled && { id: 'm-podcast'",
  '<LessonPodcastCard topicId={topicId} />',
]) {
  if (!topicDetailSource.includes(snippet)) {
    throw new Error(`Regression detected: podcast surface missing snippet: ${snippet}`);
  }
}

if (/"id: 'podcast-rail'/.test(topicDetailSource) && !/podcastEnabled && \{\s*id: 'podcast-rail'/s.test(topicDetailSource)) {
  throw new Error('Regression detected: podcast rail action must be hidden when the production podcast panel is disabled.');
}

if (/"id: 'p-podcast'/.test(topicDetailSource) && !/podcastEnabled && \{ id: 'p-podcast'/s.test(topicDetailSource)) {
  throw new Error('Regression detected: practice podcast action must be hidden when the production podcast panel is disabled.');
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
