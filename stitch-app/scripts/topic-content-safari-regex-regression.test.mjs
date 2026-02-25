import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const source = read('src/lib/topicContentFormatting.js');

assert.ok(
    !source.includes('(?<!'),
    'topicContentFormatting should avoid negative lookbehind regex for Safari compatibility.',
);

assert.ok(
    !source.includes('(?<='),
    'topicContentFormatting should avoid positive lookbehind regex for Safari compatibility.',
);

assert.match(
    source,
    /\(\^\|\[\^a-zA-Z0-9\]\)\[\*_]\{2,\}\(\?=\[\^a-zA-Z0-9\]\|\$\)/,
    'Expected Safari-safe markdown marker cleanup regex for ** and __ tokens.',
);

assert.match(
    source,
    /\(\^\|\[\^a-zA-Z0-9\]\)`\{1,3\}\(\?=\[\^a-zA-Z0-9\]\|\$\)/,
    'Expected Safari-safe markdown marker cleanup regex for backtick fences.',
);

console.log('topic-content-safari-regex-regression.test.mjs passed');

