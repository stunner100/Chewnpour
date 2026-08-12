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
assert.match(views, /Open tutor chat/, 'Desktop assistant must open the shared TopicChatPanel.');
assert.match(views, /onAsk=\{handleAskTutor\}/, 'Desktop prompts must reuse the shared tutor entry.');
assert.match(views, /<LessonTOC/, 'Desktop rail must restore LessonTOC.');
assert.doesNotMatch(views, /fetch\(`\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/chat`/, 'Desktop assistant must not keep a separate chat transcript fetch.');

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

const chatPanel = read('src/components/TopicChatPanel.jsx');
const notesPanel = read('src/components/TopicNotesPanel.jsx');
const sourcePanel = read('src/components/SourcePanel.jsx');
const sidebar = read('src/components/TopicSidebar.jsx');
const a11yHook = read('src/hooks/useSidePanelA11y.js');

assert.match(a11yHook, /getFocusable/, 'Side panel a11y hook must trap focus.');
assert.match(chatPanel, /role="dialog"/, 'Chat panel must be a dialog.');
assert.match(notesPanel, /role="dialog"/, 'Notes panel must be a dialog.');
assert.match(sourcePanel, /role="dialog"/, 'Source panel must be a dialog.');
assert.match(sidebar, /aria-expanded=\{mobileOpen\}/, 'Mobile TOC must expose expanded state.');

for (const orphan of [
  'src/components/lesson/LessonHeader.jsx',
  'src/components/lesson/StudyActionsPanel.jsx',
  'src/components/lesson/LessonProgressBar.jsx',
]) {
  try {
    read(orphan);
    assert.fail(`Expected orphan ${orphan} to be deleted.`);
  } catch (error) {
    assert.equal(error.code, 'ENOENT', `Expected orphan ${orphan} to be deleted.`);
  }
}

console.log('lesson-page-chrome-regression: ok');
