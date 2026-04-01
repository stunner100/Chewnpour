import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (file) => fs.readFile(new URL(file, import.meta.url), 'utf8');

const topicDetail = await read('../src/pages/TopicDetail.jsx');
const conceptIntro = await read('../src/pages/ConceptIntro.jsx');
const conceptBuilder = await read('../src/pages/ConceptBuilder.jsx');

assert.match(
  topicDetail,
  /to=\{topicId \? `\/dashboard\/concept\/\$\{topicId\}` : '\/dashboard\/concept'\}/,
  'topic detail should route concept practice directly into the builder'
);
assert.doesNotMatch(
  topicDetail,
  /concept-intro/,
  'topic detail should no longer link through the concept intro route'
);
assert.match(
  topicDetail,
  /Concept Practice/,
  'topic detail CTA copy should reflect the new concept practice label'
);

assert.match(
  conceptIntro,
  /<Navigate to=\{`\/dashboard\/concept\/\$\{topicId\}`\} replace \/>/,
  'concept intro should now hard-redirect into the concept builder route'
);

assert.match(
  conceptBuilder,
  /useAction\('concepts:getConceptSessionForTopic'\)/,
  'concept builder should load a session through the new session endpoint'
);
assert.match(
  conceptBuilder,
  /useMutation\('concepts:createConceptSessionAttempt'\)/,
  'concept builder should save the full session through the new mutation'
);
assert.match(
  conceptBuilder,
  /Finish Session/,
  'concept builder should expose a session completion control'
);
assert.match(
  conceptBuilder,
  /Retry Session/,
  'concept builder summary should expose a retry action'
);

console.log('concept-phase1-cutover-regression: ok');
