import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const layout = read('src/components/DashboardLayout.jsx');
const views = read('src/components/topic/TopicLessonViews.jsx');
const content = read('src/components/topic/TopicContentPanel.jsx');
const mobileActions = read('src/components/lesson/MobileLessonActions.jsx');
const fab = read('src/components/lesson/FloatingStudyTools.jsx');
const hook = read('src/hooks/useTopicDetail.js');
const practice = read('src/components/lesson/PracticeActionsCard.jsx');
const css = read('src/index.css');

assert.match(
  layout,
  /hideMobileBottomNav = \/\^\\\/dashboard\\\/\(\?:quiz\\\/\(\?!results\\\/\)\|topic\\\/\)\[\^\/]\+\//,
  'Expected DashboardLayout to hide app bottom nav on quiz and topic lesson routes.',
);

assert.match(mobileActions, /lg:hidden/, 'Lesson action bar should hide on desktop.');
assert.match(mobileActions, /text-caption/, 'Lesson action labels should use caption scale.');
assert.match(fab, /lg:hidden/, 'Study tools FAB should hide on desktop.');
assert.match(fab, /aria-expanded/, 'FAB should expose expanded state.');

assert.match(views, /parts\.join\(' · '\)/, 'Meta should be a muted text line, not pill cluster.');
assert.match(views, /max-w-\[68ch\] text-body-md/, 'Summary should be plain text under the title.');
assert.doesNotMatch(views, /Source: \{sourceLabel\}/, 'Meta should not use Source: pill chrome.');
assert.match(views, /Ask about this lesson/, 'Study assistant should use quiet secondary copy.');
assert.doesNotMatch(views, /> Online</, 'Study assistant should not show Online jewelry.');
assert.match(views, /setSettingsOpen\(true\)/, 'Desktop header must open voice settings.');
assert.match(views, /setReExplainOpen\(true\)/, 'Desktop header must expose re-explain.');
assert.match(views, /btn-primary inline-flex min-h-10/, 'Desktop header must expose sticky quiz CTA.');
assert.match(views, /prevTopic\?\.title/, 'Prev/next nav should show topic titles.');
assert.match(views, /left-4 z-30/, 'Scroll-top should sit on the left to avoid FAB collision.');

assert.match(content, /max-w-\[68ch\]/, 'Lesson prose should have a readable measure.');
assert.doesNotMatch(content, /rounded-\[28px\] border border-border-subtle bg-surface/, 'Article should not be a heavy raised card.');
assert.match(content, /border-t border-border-subtle/, 'Guided path should be a divider section.');

assert.match(practice, /border-t border-border-subtle pt-6/, 'Practice actions should be a section, not a raised card.');
assert.doesNotMatch(hook, /id: 'p-tutor'/, 'Practice secondary should not duplicate Ask AI Tutor.');
assert.match(hook, /id: 'settings'/, 'FAB tools should include voice settings.');
assert.doesNotMatch(hook, /id: 'm-podcast'/, 'Mobile bar should not advertise dead podcast CTA.');
assert.match(hook, /id: 'm-settings'/, 'Completed mobile bar should open voice settings.');

assert.match(css, /\.dark \.cp-theme \.bg-success-soft/, 'Dark mode must remap success-soft fills.');
assert.match(css, /\.dark \.cp-theme \.bg-warning-soft/, 'Dark mode must remap warning-soft fills.');

console.log('lesson-page-chrome-regression: ok');
