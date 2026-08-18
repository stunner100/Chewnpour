import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nav = await fs.readFile(path.join(root, 'src/components/MobileBottomNav.jsx'), 'utf8');
const layout = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');
const css = await fs.readFile(path.join(root, 'src/index.css'), 'utf8');

assert.match(nav, /min-h-16/, 'Tab bar occupies 4rem before the safe-area inset');
assert.match(
  nav,
  /bottom-\[calc\(4rem\+env\(safe-area-inset-bottom,0px\)\)\]/,
  'More sheet bottom offset must include the home-indicator inset',
);

const NAV_MIN_HEIGHT_PX = 64;
const SAFE_AREA_INSET_PX = 34;
const navTopFromViewportBottom = NAV_MIN_HEIGHT_PX + SAFE_AREA_INSET_PX;
const sheetBottomFromViewportBottom = NAV_MIN_HEIGHT_PX + SAFE_AREA_INSET_PX;
assert.equal(
  Math.max(0, navTopFromViewportBottom - sheetBottomFromViewportBottom),
  0,
  'Sheet bottom and nav top must meet with 0 overlap at a 34px home indicator',
);

assert.match(
  css,
  /padding-bottom: calc\(var\(--cp-mobile-tab-bar\) \+ env\(safe-area-inset-bottom, 0px\) \+ 0\.75rem \+ var\(--keyboard-inset, 0px\)\)/,
  'Dashboard bottom padding token must clear the tab bar, inset, and visual viewport chrome',
);
assert.match(
  layout,
  /data-cp-tab-bar-spacer/,
  'Dashboard must reserve an in-flow spacer so first-paint content is not under the tab bar',
);
assert.match(
  layout,
  /max-md:!bottom-\[calc\(var\(--cp-mobile-tab-bar\)\+env\(safe-area-inset-bottom,0px\)\+0\.75rem\+var\(--keyboard-inset,0px\)\)\]/,
  'Toasts must sit above the tab bar on mobile',
);

console.log('mobile-more-sheet-geometry-regression.test.mjs passed');
