// The re-explain dialog and the server share one style list, so the style a
// student picks is the one the model is asked for.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
    DEFAULT_RE_EXPLAIN_STYLE,
    RE_EXPLAIN_STYLES,
    reExplainStyleById,
} from '../src/lib/reExplainStyles.js';

const root = process.cwd();
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

assert.equal(DEFAULT_RE_EXPLAIN_STYLE, 'like_12');
assert.equal(reExplainStyleById(DEFAULT_RE_EXPLAIN_STYLE).label, 'Teach me like I’m 12');
assert.equal(new Set(RE_EXPLAIN_STYLES.map((style) => style.id)).size, RE_EXPLAIN_STYLES.length, 'style ids are unique');
for (const style of RE_EXPLAIN_STYLES) {
    assert.equal(reExplainStyleById(style.id), style, `${style.id} resolves to itself`);
    assert.ok(style.instruction.length > 20, `${style.id} has a model instruction`);
}
assert.equal(reExplainStyleById('Teach me like I\'m 12').id, 'like_12', 'unknown ids fall back to the default');

const hook = await read('src/hooks/useTopicDetail.js');
assert.match(hook, /useState\(DEFAULT_RE_EXPLAIN_STYLE\)/, 'the dialog starts on the default style');
const modal = await read('src/components/TopicReExplainModal.jsx');
assert.match(modal, /onStyleChange\(option\.id\)/, 'the dialog sends style ids');
const server = await read('server/topicExplain.js');
assert.match(server, /reExplainStyleById\(style\)/, 'the server resolves the id to its instruction');

console.log('topic-reexplain-default-style-regression.test.mjs passed');
