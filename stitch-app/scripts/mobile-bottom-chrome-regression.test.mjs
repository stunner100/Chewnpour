import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getBottomChromeLimit } from '../src/lib/bottomChrome.js';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const css = read('src/index.css');
const layout = read('src/components/DashboardLayout.jsx');
const actions = read('src/components/lesson/MobileLessonActions.jsx');
const nav = read('src/components/MobileBottomNav.jsx');
const views = read('src/components/topic/TopicLessonViews.jsx');
const popover = read('src/components/HighlightExplainPopover.jsx');

assert.match(css, /--cp-mobile-tab-bar: 4rem;/, 'Tab bar height must be a shared token.');
assert.match(css, /--cp-mobile-lesson-bar: 3.5rem;/, 'Lesson action bar height must be a shared token.');
assert.match(
  css,
  /var\(--keyboard-inset, 0px\)/,
  'Bottom padding must include the visual-viewport inset from iOS browser chrome.',
);
assert.match(css, /\.mobile-lesson-safe-bottom/, 'Lesson pages must have a dedicated bottom-clearance utility.');

assert.match(layout, /data-cp-tab-bar-spacer/, 'Dashboard must reserve layout space for the overlay tab bar.');
assert.match(layout, /hideAppHeader/, 'Quiz player must drop the app header so Settings is not one tap away.');
assert.match(
  layout,
  /\/\^\\\/dashboard\\\/quiz\\\/\(\?!results\\\/\)\[\^\/]\+\//,
  'Only the live quiz player hides the app header, not quiz results.',
);

assert.match(actions, /data-cp-bottom-chrome="lesson"/, 'Lesson action bar must expose its box for overlay collision.');
assert.match(nav, /data-cp-bottom-chrome="tabs"/, 'Tab bar must expose its box for overlay collision.');
assert.match(views, /mobile-lesson-safe-bottom/, 'Lesson shell must clear the action bar, safe area, and visual inset.');
assert.match(popover, /getBottomChromeLimit/, 'Highlight popover must clamp to the visible chrome, not innerHeight.');

const visibleWin = {
  innerHeight: 777,
  visualViewport: { offsetTop: 0, height: 669 },
  getComputedStyle: () => ({ display: 'flex', visibility: 'visible' }),
};
const chromeDoc = {
  querySelector: () => ({ getBoundingClientRect: () => ({ top: 580 }) }),
};
assert.equal(
  getBottomChromeLimit(visibleWin, chromeDoc),
  580,
  'Popover limit is the top of the lesson/tab bar when that bar is on screen.',
);

const hiddenDoc = {
  querySelector: () => ({ getBoundingClientRect: () => ({ top: 580 }) }),
};
const hiddenWin = {
  ...visibleWin,
  getComputedStyle: () => ({ display: 'none', visibility: 'visible' }),
};
assert.equal(
  getBottomChromeLimit(hiddenWin, hiddenDoc),
  669,
  'Desktop (hidden chrome) uses the visual viewport bottom.',
);

console.log('mobile-bottom-chrome-regression: ok');
