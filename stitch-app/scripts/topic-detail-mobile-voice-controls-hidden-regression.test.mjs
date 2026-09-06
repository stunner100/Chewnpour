import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const dashboardLayoutSource = await fs.readFile(
  path.join(root, 'src/components/DashboardLayout.jsx'),
  'utf8',
);
const viewsSource = await fs.readFile(
  path.join(root, 'src/components/topic/TopicLessonViews.jsx'),
  'utf8',
);
const contentPanelSource = await fs.readFile(
  path.join(root, 'src/components/topic/TopicContentPanel.jsx'),
  'utf8',
);

if (!dashboardLayoutSource.includes('(?:quiz\\/(?!results\\/)|topic\\/)')) {
  throw new Error('Expected DashboardLayout to hide the app bottom nav on topic lesson routes.');
}

for (const pattern of [
  'MobileLessonActions',
  'StudyTopBar',
  'TopicChatPanel',
]) {
  if (!viewsSource.includes(pattern)) {
    throw new Error(`Expected topic lesson chrome to include "${pattern}".`);
  }
}

if (!contentPanelSource.includes('TopicVoiceToolbar')) {
  throw new Error('Expected topic content panel to keep voice controls available.');
}

console.log('topic-detail-mobile-voice-controls-hidden-regression.test.mjs passed');
