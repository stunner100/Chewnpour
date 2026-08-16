import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'src/components/HighlightExplainPopover.jsx'), 'utf8');

assert.match(source, /\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/explain/, 'Must keep the topic explain API.');
assert.doesNotMatch(source, /from ['"]convex\/react['"]/, 'Must stay Convex-free.');
assert.match(source, /rounded-full/, 'Selection actions bar should be a pill.');
assert.match(source, /Show more actions/, 'Overflow actions should collapse behind a more control.');
assert.match(source, /Keep in notes/, 'Result mode should offer Keep in notes.');
assert.match(source, /aria-expanded=\{expanded\}/, 'More control must expose expanded state.');
assert.match(source, /key: 'explain'/, 'Explain action must remain.');
assert.match(source, /key: 'breakdown'/, 'Break down action must remain.');
assert.match(source, /key: 'simplify'/, 'Simplify action must remain in overflow.');

console.log('highlight-selection-actions-regression: ok');
