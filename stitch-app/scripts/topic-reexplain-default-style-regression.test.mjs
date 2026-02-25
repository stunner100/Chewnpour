import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const topicDetailSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'TopicDetail.jsx'),
  'utf8'
);

if (!/const\s+\[reExplainStyle,\s*setReExplainStyle\]\s*=\s*useState\('Teach me like I[’']m 12'\);/.test(topicDetailSource)) {
  throw new Error('Expected TopicDetail re-explain default style to be "Teach me like I’m 12".');
}

const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');

if (!/const\s+requestedStyle\s*=\s*String\(style\s*\|\|\s*"Teach me like I[’']m 12"\)\.trim\(\)\s*\|\|\s*"Teach me like I[’']m 12";/.test(aiSource)) {
  throw new Error('Expected reExplainTopic backend fallback style to default to "Teach me like I’m 12".');
}

console.log('topic-reexplain-default-style-regression.test.mjs passed');
