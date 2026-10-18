import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const topicDetailSource = await read('src/pages/TopicDetail.jsx');
const topicHookSource = await read('src/hooks/useTopicDetail.js');
const topicChatPanelSource = await read('src/components/TopicChatPanel.jsx');
const topicNotesPanelSource = await read('src/components/TopicNotesPanel.jsx');
const sourcePanelSource = await read('src/components/SourcePanel.jsx');
const topicSettingsModalSource = await read('src/components/TopicSettingsModal.jsx');

if (!topicHookSource.includes('getCurrentHashTargetId')) {
  throw new Error('useTopicDetail must use a shared helper for detecting deep-linked section hashes.');
}

if (!topicHookSource.includes('scrollHashTargetIntoView')) {
  throw new Error('useTopicDetail must use a shared helper for scrolling the current hash target into view.');
}

if (!topicHookSource.includes("window.addEventListener('hashchange', scrollAfterHashChange)")) {
  throw new Error('useTopicDetail must react to native/browser hash changes so section links cannot update the URL without scrolling.');
}

if (/WatermelonTabs/.test(topicDetailSource)) {
  throw new Error('TopicDetail study-mode chooser must not render misleading top tabs that disappear after selection.');
}

for (const expected of [
  'const sidePanelScrollYRef = useRef(0);',
  'const captureLessonScrollForSidePanel = useCallback(() => {',
  'const restoreLessonScrollAfterPanelClose = useCallback(() => {',
  "if (scrollHashTargetIntoView({ behavior: 'auto' })) return;",
  'window.setTimeout(restore, 120);',
]) {
  if (!topicHookSource.includes(expected)) {
    throw new Error(`useTopicDetail must preserve the lesson scroll position when side panels open/close: ${expected}`);
  }
}

if (/lg:(relative|z-auto)/.test(sourcePanelSource)) {
  throw new Error('SourcePanel must stay fixed on desktop so it opens as a stable right-side panel.');
}
if (!sourcePanelSource.includes('role="dialog"') || !sourcePanelSource.includes('aria-modal="true"')) {
  throw new Error('SourcePanel must expose dialog semantics when open.');
}
if (!sourcePanelSource.includes('useSidePanelA11y')) {
  throw new Error('SourcePanel must use the shared side-panel focus trap.');
}

if (!topicNotesPanelSource.includes("role={inline ? 'complementary' : 'dialog'}")) {
  throw new Error('TopicNotesPanel must be a complementary rail when inline and a dialog on small screens.');
}
if (!topicNotesPanelSource.includes('trapFocus: !inline')) {
  throw new Error('TopicNotesPanel must not trap focus in the desktop rail so the lesson stays interactive.');
}
if (!topicNotesPanelSource.includes('role="dialog"') && !topicNotesPanelSource.includes("role={inline ? 'complementary' : 'dialog'}")) {
  throw new Error('TopicNotesPanel must expose dialog semantics on small screens.');
}
if (!topicNotesPanelSource.includes('useSidePanelA11y')) {
  throw new Error('TopicNotesPanel must use the shared side-panel focus trap.');
}

if (/lg:(relative|z-auto)/.test(topicChatPanelSource)) {
  throw new Error('TopicChatPanel must stay fixed on desktop so it opens as a stable right-side panel.');
}
if (!topicChatPanelSource.includes("role={isDesktop ? 'complementary' : 'dialog'}")) {
  throw new Error('TopicChatPanel must be a complementary rail on desktop and a dialog on small screens.');
}
if (!topicChatPanelSource.includes('trapFocus: !isDesktop')) {
  throw new Error('TopicChatPanel must not trap focus on desktop so the lesson stays interactive.');
}
if (!topicChatPanelSource.includes('createPortal') || !topicChatPanelSource.includes('document.body')) {
  throw new Error('TopicChatPanel must portal to document.body so BlurFade/transform ancestors cannot scroll it away.');
}
if (!topicChatPanelSource.includes('lg:top-16')) {
  throw new Error('TopicChatPanel must stay below the dashboard header while remaining viewport-fixed.');
}

if (/endRef\.current\.scrollIntoView/.test(topicChatPanelSource)) {
  throw new Error('TopicChatPanel must keep auto-scroll inside the chat message container instead of scrolling the lesson page.');
}

if (!topicSettingsModalSource.includes('z-[80]')) {
  throw new Error('TopicSettingsModal must render above lesson headers and side-panel layers.');
}

if (!topicSettingsModalSource.includes('createPortal') || !topicSettingsModalSource.includes('document.body')) {
  throw new Error('TopicSettingsModal must portal to document.body so BlurFade/transform ancestors cannot trap it.');
}

if (!topicSettingsModalSource.includes('role="dialog"') || !topicSettingsModalSource.includes('aria-modal="true"')) {
  throw new Error('TopicSettingsModal must expose dialog semantics when open.');
}

console.log('topic-detail-controls-regression.test.mjs passed');
