import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'src/components/HighlightExplainPopover.jsx'), 'utf8');

assert.match(source, /\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/explain/, 'Must keep the topic explain API.');
assert.doesNotMatch(source, /from ['"]convex\/react['"]/, 'Must stay Convex-free.');
assert.match(source, /key: 'explain'/, 'Explain action must remain.');
assert.match(source, /key: 'simplify'/, 'Simplify action must remain.');
assert.match(source, /key: 'example'/, 'Example action must remain.');
assert.match(source, /Save/, 'Save must use notes when supported.');
assert.match(source, /Keep in notes/, 'Result mode should offer Keep in notes.');
assert.match(source, /getBottomChromeLimit/, 'Popover must stay above the lesson action bar.');
assert.match(source, /isCompact/, 'Mobile must use a compact action bar, not a tiny desktop popover.');

console.log('highlight-selection-actions-regression: ok');
