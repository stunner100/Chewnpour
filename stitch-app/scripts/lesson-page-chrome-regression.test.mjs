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
const renderer = read('src/components/LessonContentRenderer.jsx');
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

assert.match(views, /masteryLabel/, 'Meta should be status-only, not a pill cluster.');
assert.doesNotMatch(views, /parts\.join\(' · '\)/, 'Meta should not restate course + status.');
assert.match(views, /max-w-\[68ch\] text-body-md/, 'Summary should be plain text under the title.');
assert.match(views, /Open AI Tutor/, 'Desktop assistant must open the shared TopicChatPanel.');
assert.match(views, /onAsk=\{handleAskTutor\}/, 'Desktop prompts must reuse the shared tutor entry.');
assert.match(views, /<LessonTOC/, 'Desktop rail must restore LessonTOC.');
assert.match(views, /btn-secondary inline-flex min-h-11 max-w-\[46%\]/, 'Next lesson CTA should be quieter than the quiz primary.');
assert.doesNotMatch(views, /fetch\(`\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/chat`/, 'Desktop assistant must not keep a separate chat transcript fetch.');
assert.doesNotMatch(views, /rounded-2xl border border-border-subtle bg-surface-soft\/60 p-4/, 'Study Assistant should not be a tall empty card.');

assert.match(content, /max-w-\[65ch\]/, 'Lesson prose should have a readable measure.');
assert.match(content, /showTopicIllustration && topicIllustrationUrl/, 'Lesson page must gate illustrations.');
assert.match(content, /border-t border-border-subtle/, 'Guided path should be a divider section.');

assert.match(practice, /border-t border-border-subtle pt-6/, 'Practice actions should be a section, not a raised card.');
assert.match(hook, /const practicePrimary = \[\];/, 'Practice block must not own a second solid quiz primary.');
assert.match(hook, /id: 'p-start-quiz'/, 'Practice secondary should still offer Start quiz.');
assert.match(hook, /'Start quiz'/, 'Quiz CTA copy should be unified as Start quiz.');
assert.match(hook, /skippedDuplicateTitle/, 'Duplicate page-title H1 must be stripped from article blocks.');
assert.match(hook, /showTopicIllustration/, 'Hook must expose illustration gating.');
assert.doesNotMatch(hook, /id: 'p-tutor'/, 'Practice secondary should not duplicate Ask AI Tutor.');
assert.match(hook, /id: 'settings'/, 'FAB tools should include voice settings.');
assert.doesNotMatch(hook, /id: 'm-podcast'/, 'Mobile bar should not advertise dead podcast CTA.');
assert.match(hook, /id: 'm-settings'/, 'Completed mobile bar should open voice settings.');

assert.match(renderer, /SectionAskMenu/, 'Section tutor chips must collapse into one Ask menu.');
assert.match(renderer, /Ask about this section/, 'Section ask control must use a single overflow entry.');
assert.doesNotMatch(renderer, /flex items-center gap-1\.5 flex-wrap mb-3 -mt-1/, 'Section must not show four equal tutor chips.');

assert.match(css, /\.dark \.cp-theme \.bg-success-soft/, 'Dark mode must remap success-soft fills.');
assert.match(css, /\.dark \.cp-theme \.bg-warning-soft/, 'Dark mode must remap warning-soft fills.');

const chatPanel = read('src/components/TopicChatPanel.jsx');
const notesPanel = read('src/components/TopicNotesPanel.jsx');
const sourcePanel = read('src/components/SourcePanel.jsx');
const sidebar = read('src/components/TopicSidebar.jsx');
const a11yHook = read('src/hooks/useSidePanelA11y.js');

assert.match(a11yHook, /getFocusable/, 'Side panel a11y hook must trap focus.');
assert.match(chatPanel, /role=\{isDesktop \? 'complementary' : 'dialog'\}/, 'Desktop tutor must be a non-modal complementary rail.');
assert.match(chatPanel, /trapFocus: !isDesktop/, 'Desktop tutor must leave the lesson interactive.');
assert.match(chatPanel, /lg:hidden/, 'Tutor backdrop must only cover the lesson on small screens.');
assert.match(chatPanel, /suggestedPrompts=\{suggestedPrompts\}/, 'Welcome chips must live next to the greeting.');
assert.match(chatPanel, /suggestedPrompts=\{\[\]\}/, 'Composer must not duplicate welcome chips.');
assert.match(chatPanel, /Tutor style/, 'Persona control must use a visible Tutor style label.');
assert.match(hook, /label: 'AI Tutor'/, 'Mobile lesson actions must use AI Tutor, not a shortened Tutor label.');
assert.match(chatPanel, /shrink-0/, 'Tutor composer must stay pinned and not get pushed off-screen.');
assert.match(chatPanel, /max-h-dvh/, 'Tutor chat must bound height to the viewport.');
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
