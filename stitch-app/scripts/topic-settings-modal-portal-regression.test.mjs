import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const settings = read('src/components/TopicSettingsModal.jsx');
const reExplain = read('src/components/TopicReExplainModal.jsx');
const hook = read('src/hooks/useTopicDetail.js');
const views = read('src/components/topic/TopicLessonViews.jsx');

assert.match(settings, /createPortal/, 'Lesson settings must portal to document.body.');
assert.match(settings, /document\.body/, 'Lesson settings portal target must be document.body.');
assert.match(settings, /z-\[80\]/, 'Lesson settings must stay above lesson chrome.');
assert.match(settings, /cp-theme/, 'Portaled settings must keep cp-theme so dark surfaces apply.');
assert.match(settings, /bg-surface-light/, 'Settings dialog must use an opaque surface, not theme-scoped bg-surface.');
assert.match(settings, /dark:bg-surface-dark/, 'Settings dialog must stay opaque in dark mode.');
assert.match(settings, /Escape/, 'Lesson settings must close on Escape.');
assert.match(reExplain, /createPortal/, 'Re-explain must portal to document.body.');
assert.match(reExplain, /bg-surface-light/, 'Re-explain dialog must use an opaque surface.');
assert.match(reExplain, /dark:bg-surface-dark/, 'Re-explain dialog must stay opaque in dark mode.');
assert.match(reExplain, /z-\[80\]/, 'Re-explain must stay above lesson chrome.');
assert.match(hook, /Boolean\(profile\?\.voiceModeEnabled\)/, 'Voice mode must read from the user profile.');
assert.match(hook, /id: 'settings',/, 'More study tools must include voice settings.');
assert.doesNotMatch(hook, /const voiceModeEnabled = false/, 'Voice mode must not be hard-disabled.');
assert.match(views, /studyToolSecondary/, 'More study tools must own the settings entry point.');
assert.match(views, /<TopicSettingsModal/, 'Lesson shell must render the settings modal.');

console.log('topic-settings-modal-portal-regression: ok');
