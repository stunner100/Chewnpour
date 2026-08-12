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
assert.match(settings, /Escape/, 'Lesson settings must close on Escape.');
assert.match(reExplain, /createPortal/, 'Re-explain must portal to document.body.');
assert.match(reExplain, /z-\[80\]/, 'Re-explain must stay above lesson chrome.');
assert.match(hook, /Boolean\(profile\?\.voiceModeEnabled\)/, 'Voice mode must read from the user profile.');
assert.doesNotMatch(hook, /const voiceModeEnabled = false/, 'Voice mode must not be hard-disabled.');
assert.match(views, /setSettingsOpen\(true\)/, 'Header settings icon must open the settings modal.');
assert.match(views, /<TopicSettingsModal/, 'Lesson shell must render the settings modal.');

console.log('topic-settings-modal-portal-regression: ok');
