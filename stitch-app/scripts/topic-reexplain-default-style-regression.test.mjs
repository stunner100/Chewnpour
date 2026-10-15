import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const hookSource = await fs.readFile(
  path.join(root, 'src', 'hooks', 'useTopicDetail.js'),
  'utf8'
);

if (!/const\s+\[reExplainStyle,\s*setReExplainStyle\]\s*=\s*useState\(["']Teach me like I[’']m 12["']\);/.test(hookSource)) {
  throw new Error('Expected TopicDetail re-explain default style to be "Teach me like I’m 12".');
}

const explainSource = await fs.readFile(path.join(root, 'server', 'topicExplain.js'), 'utf8');

if (!/REEXPLAIN_STYLES\.includes\(style\)\s*\?\s*style\s*:\s*"Teach me like I[’']m 12";/.test(explainSource)) {
  throw new Error('Expected reExplainTopic backend fallback style to default to "Teach me like I’m 12".');
}

console.log('topic-reexplain-default-style-regression.test.mjs passed');
