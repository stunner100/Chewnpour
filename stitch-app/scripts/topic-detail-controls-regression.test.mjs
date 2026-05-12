import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const lessonTocSource = await read('src/components/lesson/LessonTOC.jsx');
const topicDetailSource = await read('src/pages/TopicDetail.jsx');
const topicSidebarSource = await read('src/components/TopicSidebar.jsx');
const topicChatPanelSource = await read('src/components/TopicChatPanel.jsx');
const topicNotesPanelSource = await read('src/components/TopicNotesPanel.jsx');
const sourcePanelSource = await read('src/components/SourcePanel.jsx');
const topicSettingsModalSource = await read('src/components/TopicSettingsModal.jsx');
const voicePlaybackSource = await read('src/lib/useVoicePlayback.js');

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
  'behavior: \'smooth\'',
]) {
  if (!lessonTocSource.includes(expected)) {
    throw new Error(`Expected LessonTOC to keep active-item scrolling inside the TOC rail with "${expected}".`);
  }
}

if (!topicDetailSource.includes('const getCurrentHashTargetId = () => {')) {
  throw new Error('TopicDetail must use a shared helper for detecting deep-linked section hashes.');
}

if (!topicDetailSource.includes('const scrollHashTargetIntoView = ({ behavior = \'auto\' } = {}) => {')) {
  throw new Error('TopicDetail must use a shared helper for scrolling the current hash target into view.');
}

if (!/value:\s*getCurrentHashTargetId\(\) \? 'full' : null/.test(topicDetailSource)) {
  throw new Error('TopicDetail must bypass the study-mode chooser when the URL already points at a lesson section hash.');
}

if (/setStudyMode\(null\);/.test(topicDetailSource)) {
  throw new Error('TopicDetail route changes must preserve hash deep links instead of always resetting to the chooser.');
}

if (!/if \(getCurrentHashTargetId\(\)\) return;[\s\S]*window\.scrollTo\(0, 0\);/.test(topicDetailSource)) {
  throw new Error('TopicDetail must not run its top-of-page navigation reset when loading a hash deep link.');
}

if (!/node\.scrollIntoView\(\{\s*behavior,\s*block: 'start',?\s*\}\)/s.test(topicDetailSource)) {
  throw new Error('TopicDetail must scroll the hashed section into view after the lesson content has mounted.');
}

if (!/window\.addEventListener\('hashchange', scrollAfterHashChange\)/.test(topicDetailSource)) {
  throw new Error('TopicDetail must react to native/browser hash changes so section links cannot update the URL without scrolling.');
}

if (/WatermelonTabs/.test(topicDetailSource)) {
  throw new Error('TopicDetail study-mode chooser must not render misleading top tabs that disappear after selection.');
}

if (!/topicProgress\?\.completedAt && \([\s\S]*<NextStepsGuidance/.test(topicDetailSource)) {
  throw new Error('TopicDetail should only show the post-lesson next-steps card after completion to avoid duplicating practice CTAs.');
}

for (const expected of [
  'const sidePanelScrollYRef = useRef(0);',
  'const captureLessonScrollForSidePanel = useCallback(() => {',
  'const restoreLessonScrollAfterPanelClose = useCallback(() => {',
  'if (scrollHashTargetIntoView({ behavior: \'auto\' })) return;',
  'window.setTimeout(restore, 120);',
]) {
  if (!topicDetailSource.includes(expected)) {
    throw new Error(`TopicDetail must preserve the lesson scroll position when side panels open/close: ${expected}`);
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
}

if (/endRef\.current\.scrollIntoView/.test(topicChatPanelSource)) {
  throw new Error('TopicChatPanel must keep auto-scroll inside the chat message container instead of scrolling the lesson page.');
}

if (!/messagesContainer\.scrollTo\(\{[\s\S]*top: messagesContainer\.scrollHeight,[\s\S]*behavior: 'smooth'/.test(topicChatPanelSource)) {
  throw new Error('TopicChatPanel must scroll its own message container to the latest message.');
}

if (!topicSettingsModalSource.includes('z-[80]')) {
  throw new Error('TopicSettingsModal must render above lesson headers and side-panel layers.');
}

if (!topicSettingsModalSource.includes('role="dialog"') || !topicSettingsModalSource.includes('aria-modal="true"')) {
  throw new Error('TopicSettingsModal must expose dialog semantics when open.');
}

if (!voicePlaybackSource.includes('const sourceUrl = await fetchRemoteAudioBlobUrl(streamUrl);')) {
  throw new Error('Voice playback must fetch remote stream URLs into blob URLs before assigning them to audio.src.');
}

if (/const sourceUrl = isMobileBrowser\s*\?\s*await fetchRemoteAudioBlobUrl\(streamUrl\)\s*:\s*streamUrl;/s.test(voicePlaybackSource)) {
  throw new Error('Voice playback must not use the remote stream URL directly on desktop.');
}

if (!voicePlaybackSource.includes('activeAudioObjectUrlRef.current = sourceUrl;')) {
  throw new Error('Voice playback must track fetched blob URLs so they can be revoked.');
}

console.log('topic-detail-controls-regression.test.mjs passed');
