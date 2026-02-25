import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const modalSource = await fs.readFile(
  path.join(root, 'src', 'components', 'TopicReExplainModal.jsx'),
  'utf8'
);

if (!/['"]Ghanaian Pidgin['"]/.test(modalSource)) {
  throw new Error('Expected TopicReExplainModal to include "Ghanaian Pidgin" in RE_EXPLAIN_STYLES.');
}

const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');

if (!/const\s+GHANAIAN_PIDGIN_STYLE_PATTERN\s*=/.test(aiSource)) {
  throw new Error('Expected ai.ts to define GHANAIAN_PIDGIN_STYLE_PATTERN.');
}

if (!/const\s+generateGhanaianPidginRewrite\s*=\s*async\s*\(args:\s*\{[\s\S]*?\}\)\s*=>/.test(aiSource)) {
  throw new Error('Expected ai.ts to define generateGhanaianPidginRewrite helper.');
}

if (!/if\s*\(GHANAIAN_PIDGIN_STYLE_PATTERN\.test\(normalizedStyle\)\)\s*\{[\s\S]*generateGhanaianPidginRewrite/s.test(aiSource)) {
  throw new Error('Expected reExplainTopic to route pidgin styles through generateGhanaianPidginRewrite.');
}

if (!/Write fully in Ghanaian Pidgin only\./.test(aiSource)) {
  throw new Error('Expected pidgin rewrite prompt to enforce full Ghanaian Pidgin output.');
}

if (!/Do not include standard-English explanatory paragraphs\./.test(aiSource)) {
  throw new Error('Expected pidgin rewrite prompt to disallow standard-English explanatory paragraphs.');
}

if (!/Do not add English translations or bilingual lines\./.test(aiSource)) {
  throw new Error('Expected pidgin rewrite prompt to disallow bilingual fallback output.');
}

console.log('reexplain-pidgin-mode-regression.test.mjs passed');
