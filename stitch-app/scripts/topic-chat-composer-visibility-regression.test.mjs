import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const panel = read('src/components/TopicChatPanel.jsx');
const surface = read('src/components/tutor/TutorChatSurface.jsx');
const scroller = read('src/components/ui/message-scroller.jsx');
const prompt = read('src/components/ai-elements/prompt-input.jsx');
const fab = read('src/components/lesson/FloatingStudyTools.jsx');
const views = read('src/components/topic/TopicLessonViews.jsx');

assert.match(
  scroller,
  /MessageScrollerPrimitive\.Root[\s\S]*?h-auto w-full min-h-0 flex-1/,
  'Message scroller root must flex inside the panel instead of forcing size-full height.',
);
assert.doesNotMatch(
  scroller,
  /MessageScrollerPrimitive\.Root[\s\S]*?size-full[\s\S]*?MessageScrollerPrimitive\.Viewport/,
  'Message scroller root must not use size-full (pushes composer off-screen).',
);
assert.match(surface, /flex shrink-0 flex-col gap-3/, 'Composer shell must shrink-0 so it remains visible.');
assert.match(prompt, /InputGroup className="h-auto overflow-hidden"/, 'Prompt input group must allow textarea height.');
assert.match(panel, /createPortal/, 'Topic chat must portal out of the scrolling lesson so it stays on screen.');
assert.match(panel, /document\.body/, 'Topic chat must portal to document.body.');
assert.match(panel, /bg-black\/40/, 'Topic chat must use a dimming backdrop over lesson text.');
assert.match(panel, /lg:hidden/, 'Tutor backdrop must not cover the lesson on desktop.');
assert.match(views, /!chatOpen && !notesOpen/, 'Lesson action bar must hide while tutor chat is open.');
assert.match(fab, /if \(hidden \|\| tools\.length === 0\) return null/, 'FAB must fully unmount when hidden.');
console.log('topic-chat-composer-visibility-regression: ok');
