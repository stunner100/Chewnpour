import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const layout = read('src/components/DashboardLayout.jsx');
const views = read('src/components/topic/TopicLessonViews.jsx');
const content = read('src/components/topic/TopicContentPanel.jsx');
const stepper = read('src/components/lesson/LessonSectionStepper.jsx');
const mobileActions = read('src/components/lesson/MobileLessonActions.jsx');
const hook = read('src/hooks/useTopicDetail.js');
const renderer = read('src/components/LessonContentRenderer.jsx');
const css = read('src/index.css');

assert.match(
  layout,
  /\/\^\\\/dashboard\\\/\(\?:quiz\\\/\(\?!results\\\/\)\|topic\\\/\)\[\^\/]\+\//,
  'Expected DashboardLayout to hide app bottom nav on quiz and topic lesson routes.',
);
assert.match(layout, /immersive \|\|/, 'Live exams must also hide the tab bar via immersive chrome.');
assert.match(
  layout,
  /hideAppHeader = \/\^\\\/dashboard\\\/\(\?:quiz\\\/\(\?!results\\\/\)\[\^\/]\+\|topic\\\/\)\[\^\/]\+\//,
  'Topic lesson routes must also drop the app header (study mode).',
);
assert.match(layout, /StudyModeSidebarQuiet/, 'Sidebar must collapse while studying.');
assert.match(layout, /STUDY_ROUTE_PATTERN/, 'Study routes must be detected for quiet chrome.');

assert.match(mobileActions, /lg:hidden/, 'Lesson action bar should hide on desktop.');
assert.match(mobileActions, /text-caption/, 'Lesson action labels should use caption scale.');
assert.match(views, /MobileLessonActions/, 'Mobile lesson bar must stay mounted.');

// Study mode shell (Phase 1)
assert.match(views, /StudyShell/, 'Lesson must render inside the study shell.');
assert.match(views, /StudyTopBar/, 'Study mode must have a quiet top bar.');
assert.match(views, /onOpenChat=\{openChat\}/, 'Top bar must expose the AI tutor.');
assert.match(views, /onOpenNotes=\{openNotes\}/, 'Top bar must expose notes.');
assert.match(views, /tutorOpen=\{chatOpen\}/, 'Tutor rail must open in-flow on desktop.');
assert.match(views, /<TopicChatPanel\s*\n\s*inline/, 'Desktop tutor must render as an inline rail.');
assert.match(views, /lg:hidden/, 'Mobile tutor must keep the full-screen sheet.');
assert.match(views, /TopicLessonNav/, 'Prev/next lesson navigation must stay.');

const shell = read('src/components/study/StudyShell.jsx');
assert.match(shell, /max-w-\[720px\]/, 'Reading column must target ~720px.');
assert.match(shell, /w-\[380px\]/, 'Tutor rail must target ~380px.');
assert.match(shell, /useReducedMotion/, 'Study shell motion must respect reduced motion.');

const topBar = read('src/components/study/StudyTopBar.jsx');
assert.match(topBar, /StudyProgress/, 'Top bar must show lesson progress.');
assert.match(topBar, /arrow_back/, 'Top bar must keep exit navigation.');

const progress = read('src/components/study/StudyProgress.jsx');
assert.match(progress, /role="progressbar"/, 'Study progress must be an accessible progressbar.');
assert.match(progress, /aria-valuenow/, 'Study progress must expose its value.');

const completion = read('src/components/study/LessonCompletion.jsx');
assert.match(completion, /Lesson complete/, 'Completion must be a deliberate moment.');
assert.match(completion, /Start quiz/, 'Completion must lead into the quiz.');
assert.match(completion, /onComplete/, 'Completion must use the existing persistence callback.');

assert.match(content, /max-w-\[720px\]/, 'Lesson prose should have a readable measure.');
assert.match(content, /showTopicIllustration && topicIllustrationUrl/, 'Lesson page must gate illustrations.');
assert.match(content, /LessonSectionStepper/, 'Lesson page must use the section stepper.');
assert.match(content, /contentRef=\{contentRef\}/, 'Highlight selection must target the reading stage, not the whole column.');
assert.match(content, /onFinishLesson=\{handleFinishLesson\}/, 'Stepper must persist completion.');
assert.doesNotMatch(content, /onViewSource/, 'Dead source affordance must not reach the stepper.');

assert.match(stepper, /lesson-reading-stage/, 'Lesson prose must live in a dedicated reading stage.');
assert.match(stepper, /LessonInlineCheck/, 'Inline checks must stay with the stepper.');
assert.match(css, /\.lesson-reading-stage/, 'Reading stage must have a dedicated surface in CSS.');

assert.match(hook, /handleFinishLesson/, 'Hook must expose persisted finish.');
assert.match(hook, /completedAt: Date\.now\(\)/, 'Finish must write completed_at.');
assert.match(hook, /handleSaveSelectionToNotes/, 'Hook must save selections into notes.');
assert.match(hook, /skippedDuplicateTitle/, 'Duplicate page-title H1 must be stripped from article blocks.');
assert.match(hook, /showTopicIllustration/, 'Hook must expose illustration gating.');
assert.match(hook, /hasSourcePassages && \{/, 'Source tool must hide while passages are empty.');
assert.match(hook, /id: 'settings'/, 'More tools should include voice settings.');
assert.match(hook, /currentStepIndex/, 'Hook must track the active lesson step.');
assert.doesNotMatch(hook, /id: 'm-quiz'/, 'Mobile bar must not duplicate the quiz dock.');

assert.match(renderer, /SectionAskMenu/, 'Section tutor chips must collapse into one Ask menu.');
assert.match(renderer, /Ask about this section/, 'Section ask control must use a single overflow entry.');

assert.match(css, /\.dark \.cp-theme \.bg-success-soft/, 'Dark mode must remap success-soft fills.');
assert.match(css, /\.dark \.cp-theme \.bg-warning-soft/, 'Dark mode must remap warning-soft fills.');

const chatPanel = read('src/components/TopicChatPanel.jsx');
const notesPanel = read('src/components/TopicNotesPanel.jsx');
const sidebar = read('src/components/TopicSidebar.jsx');
const a11yHook = read('src/hooks/useSidePanelA11y.js');

assert.match(a11yHook, /getFocusable/, 'Side panel a11y hook must trap focus.');
assert.match(chatPanel, /role=\{isDesktop \? 'complementary' : 'dialog'\}/, 'Desktop tutor must be a non-modal complementary rail.');
assert.match(chatPanel, /trapFocus: !isDesktop/, 'Desktop tutor must leave the lesson interactive.');
assert.match(chatPanel, /suggestedPrompts=\{suggestedPrompts\}/, 'Welcome chips must live next to the greeting.');
assert.match(chatPanel, /Give me an example/, 'Tutor suggestions must match the study actions.');
assert.match(chatPanel, /Summarise this section/, 'Tutor suggestions must match the study actions.');
assert.match(chatPanel, /Ask about this lesson\./, 'Tutor rail must set lesson context.');
assert.match(chatPanel, /showComposerSuggestions=\{false\}/, 'Composer must not duplicate welcome chips.');
assert.match(chatPanel, /Tutor style/, 'Persona control must use a visible Tutor style label.');
assert.match(chatPanel, /inline = false/, 'Tutor panel must support the inline rail variant.');
assert.match(hook, /label: 'AI Tutor'/, 'Mobile lesson actions must use AI Tutor, not a shortened Tutor label.');
assert.match(notesPanel, /role="dialog"/, 'Notes panel must be a dialog.');
assert.match(sidebar, /aria-expanded=\{mobileOpen\}/, 'Mobile TOC must expose expanded state.');

const popover = read('src/components/HighlightExplainPopover.jsx');
assert.match(popover, /onSaveSelection/, 'Selection popover must offer Save.');
assert.match(popover, /label: 'Example'/, 'Selection popover must offer Example.');
assert.match(popover, /label: 'Simplify'/, 'Selection popover must offer Simplify.');

const explainServer = read('server/topicExplain.js');
assert.match(explainServer, /example:/, 'Explain endpoint must support the example style.');

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
