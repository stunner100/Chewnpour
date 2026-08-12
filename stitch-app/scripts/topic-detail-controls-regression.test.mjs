import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const lessonTocSource = await read('src/components/lesson/LessonTOC.jsx');
const topicDetailSource = await read('src/pages/TopicDetail.jsx');
const topicHookSource = await read('src/hooks/useTopicDetail.js');
const topicSidebarSource = await read('src/components/TopicSidebar.jsx');
const topicChatPanelSource = await read('src/components/TopicChatPanel.jsx');
const topicNotesPanelSource = await read('src/components/TopicNotesPanel.jsx');
const sourcePanelSource = await read('src/components/SourcePanel.jsx');
const topicSettingsModalSource = await read('src/components/TopicSettingsModal.jsx');
const topicQuizPanelSource = await read('src/components/topic/TopicQuizPanel.jsx');

if (/node\.scrollIntoView\(\{ block: 'nearest' \}\)/.test(lessonTocSource)) {
  throw new Error('LessonTOC active item sync must not call element.scrollIntoView because it can scroll the lesson page away from the selected section.');
}

if (!/node\.scrollIntoView\(\{\s*behavior: 'smooth',\s*block: 'start',\s*\}\)/s.test(lessonTocSource)) {
  throw new Error('LessonTOC section clicks must use target scrollIntoView so header scroll-margin offsets are honored.');
}

if (/const top = node\.getBoundingClientRect\(\)\.top \+ window\.scrollY - headerOffset;/.test(lessonTocSource)) {
  throw new Error('LessonTOC section clicks must not manually calculate window scroll offsets.');
}

if (!/el\.scrollIntoView\(\{\s*behavior: 'smooth',\s*block: 'start',\s*\}\)/s.test(topicSidebarSource)) {
  throw new Error('TopicSidebar mobile section clicks must use target scrollIntoView so header scroll-margin offsets are honored.');
}

if (/const top = el\.getBoundingClientRect\(\)\.top \+ window\.scrollY - 108;/.test(topicSidebarSource)) {
  throw new Error('TopicSidebar mobile section clicks must not manually calculate window scroll offsets.');
}

for (const expected of [
  'const scrollContainer = navRef.current;',
  'scrollContainer.scrollTo({',
  "behavior: 'smooth'",
]) {
  if (!lessonTocSource.includes(expected)) {
    throw new Error(`Expected LessonTOC to keep active-item scrolling inside the TOC rail with "${expected}".`);
  }
}

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

if (!/topicProgress\?\.completedAt \? \(/.test(topicQuizPanelSource) || !topicQuizPanelSource.includes('<NextStepsGuidance')) {
  throw new Error('TopicQuizPanel should only show the post-lesson next-steps card after completion to avoid duplicating practice CTAs.');
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

for (const [name, source] of [
  ['TopicChatPanel', topicChatPanelSource],
  ['TopicNotesPanel', topicNotesPanelSource],
  ['SourcePanel', sourcePanelSource],
]) {
  if (/lg:(relative|z-auto)/.test(source)) {
    throw new Error(`${name} must stay fixed on desktop so it opens as a stable right-side panel.`);
  }
  if (!source.includes('role="dialog"') || !source.includes('aria-modal="true"')) {
    throw new Error(`${name} must expose dialog semantics when open.`);
  }
  if (!source.includes('useSidePanelA11y')) {
    throw new Error(`${name} must use the shared side-panel focus trap.`);
  }
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
