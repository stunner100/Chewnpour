import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
    topicDetailSource,
    topicViewsSource,
    useTopicDetailSource,
    adminDashboardSource,
    adminShellSource,
] = await Promise.all([
    read('src/pages/TopicDetail.jsx'),
    read('src/components/topic/TopicLessonViews.jsx'),
    read('src/hooks/useTopicDetail.js'),
    read('src/pages/AdminDashboard.jsx'),
    read('src/pages/admin/AdminDashboard.jsx'),
]);

const topicDetailLines = topicDetailSource.split('\n').length;
if (topicDetailLines > 120) {
    throw new Error(`Expected TopicDetail.jsx to stay under 120 lines, got ${topicDetailLines}.`);
}

for (const [label, source, snippet] of [
    ['TopicDetail', topicDetailSource, 'useTopicDetail'],
    ['TopicDetail', topicDetailSource, 'TopicLessonShell'],
    ['useTopicDetail', useTopicDetailSource, 'export const useTopicDetail'],
    ['TopicLessonViews', topicViewsSource, 'TopicContentPanel'],
    ['TopicLessonViews', topicViewsSource, 'StudyShell'],
    ['AdminDashboard re-export', adminDashboardSource, "./admin/AdminDashboard"],
    ['AdminDashboard shell', adminShellSource, './panels/OverviewPanel'],
    ['AdminDashboard shell', adminShellSource, './panels/ContentPanel'],
]) {
    if (!source.includes(snippet)) {
        throw new Error(`Expected ${label} to include "${snippet}".`);
    }
}

if (topicDetailSource.includes('useTopicDetailController')) {
    throw new Error('TopicDetail should not define useTopicDetailController inline.');
}

if (adminShellSource.includes('const OverviewPanel =')) {
    throw new Error('Admin shell should import OverviewPanel instead of defining it inline.');
}

console.log('topic-admin-split-regression.test.mjs passed');
