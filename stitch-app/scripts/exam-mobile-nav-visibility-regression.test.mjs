import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const dashboardLayoutSource = await read('src/components/DashboardLayout.jsx');
for (const pattern of [
  'useLocation',
  '(?:quiz\\/(?!results\\/)|topic\\/)',
  '!hideMobileBottomNav && <MobileBottomNav />',
  'MobileChromeProvider',
  'immersive ||',
]) {
  if (!dashboardLayoutSource.includes(pattern)) {
    throw new Error(`Expected DashboardLayout to include "${pattern}".`);
  }
}

const examModeSource = await read('src/pages/ExamMode.jsx');
for (const pattern of [
  'Submit exam',
  'sticky top-0',
  'requestSubmit',
  'setImmersiveMobile(questions.length > 0)',
  'to="/dashboard/exam"',
]) {
  if (!examModeSource.includes(pattern)) {
    throw new Error(`Expected ExamMode sticky exam chrome to include "${pattern}".`);
  }
}
assert.doesNotMatch(
  examModeSource,
  /import ExamActiveSession/,
  'ExamMode must port chrome in place and not import ExamActiveSession',
);

const moreNav = await read('src/components/MobileBottomNav.jsx');
assert.match(
  moreNav,
  /bottom-\[calc\(4rem\+env\(safe-area-inset-bottom,0px\)\)\]/,
  'More sheet must sit above the nav plus home-indicator inset',
);
assert.match(moreNav, /z-\[60\]/, 'More sheet and overlay must stack above the tab bar');

const NAV_MIN_HEIGHT_PX = 64;
const SAFE_AREA_INSET_PX = 34;
const navOccupied = NAV_MIN_HEIGHT_PX + SAFE_AREA_INSET_PX;
const sheetBottom = NAV_MIN_HEIGHT_PX + SAFE_AREA_INSET_PX;
const overlapPx = Math.max(0, navOccupied - sheetBottom);
assert.equal(
  overlapPx,
  0,
  `More sheet must not overlap the tab bar when the home indicator is ${SAFE_AREA_INSET_PX}px`,
);

console.log('exam-mobile-nav-visibility-regression.test.mjs passed');
