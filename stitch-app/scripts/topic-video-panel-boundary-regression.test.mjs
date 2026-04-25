import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const panelSource = await fs.readFile(
    path.join(root, 'src', 'components', 'TopicVideoPanel.jsx'),
    'utf8',
);

if (!/class TopicVideoPanelBoundary extends Component/.test(panelSource)) {
    throw new Error('Expected TopicVideoPanel to isolate video query failures from the topic page.');
}

if (!/static getDerivedStateFromError/.test(panelSource)) {
    throw new Error('Expected TopicVideoPanelBoundary to implement getDerivedStateFromError.');
}

if (!/<TopicVideoPanelBoundary\b[^>]*topicId=\{topicId\}/.test(panelSource)) {
    throw new Error('Expected the exported TopicVideoPanel to wrap the inner panel in TopicVideoPanelBoundary.');
}

if (!/<TopicVideoPanelInner\b[^>]*topicId=\{topicId\}/.test(panelSource)) {
    throw new Error('Expected the exported TopicVideoPanel to render TopicVideoPanelInner inside the boundary.');
}

if (!/api\.videos\.listTopicVideos/.test(panelSource)) {
    throw new Error('Expected TopicVideoPanel to call api.videos.listTopicVideos.');
}

console.log('topic-video-panel-boundary-regression.test.mjs passed');
