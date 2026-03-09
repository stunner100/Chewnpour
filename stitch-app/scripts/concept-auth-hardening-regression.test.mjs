import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const conceptsSource = await fs.readFile(path.join(root, 'convex', 'concepts.ts'), 'utf8');
const createConceptAttemptMatch = conceptsSource.match(
  /export const createConceptAttempt = mutation\(\{[\s\S]*?\n\}\);/m,
);
if (!createConceptAttemptMatch) {
  throw new Error('createConceptAttempt mutation not found.');
}
const createConceptAttemptArgs = createConceptAttemptMatch[0].split('handler:')[0] || '';
if (/\buserId\s*:/.test(createConceptAttemptArgs)) {
  throw new Error('createConceptAttempt must not accept client-provided userId.');
}
if (!/export const getUserConceptAttempts = query\(\{\s*args:\s*\{\}/s.test(conceptsSource)) {
  throw new Error('getUserConceptAttempts must use auth-derived identity with empty args.');
}
if (!/export const getUserConceptAttemptsForTopicInternal = internalQuery\(/.test(conceptsSource)) {
  throw new Error('Expected internal concept-attempt history query for server-side generation.');
}
if (!/const userId = assertAuthorizedUser\(\{\s*authUserId\s*\}\);/.test(conceptsSource)) {
  throw new Error('createConceptAttempt must derive userId from authenticated identity.');
}
if (!/resourceOwnerUserId:\s*course\.userId/.test(conceptsSource)) {
  throw new Error('createConceptAttempt must verify topic ownership before inserting attempts.');
}

const topicsSource = await fs.readFile(path.join(root, 'convex', 'topics.ts'), 'utf8');
if (!/export const getTopicWithQuestions = query\(/.test(topicsSource)) {
  throw new Error('Expected public getTopicWithQuestions query.');
}
if (!/const identity = await ctx\.auth\.getUserIdentity\(\);/.test(topicsSource)) {
  throw new Error('getTopicWithQuestions must require authenticated identity.');
}
if (!/resourceOwnerUserId:\s*payload\.ownerUserId/.test(topicsSource)) {
  throw new Error('getTopicWithQuestions must enforce topic ownership checks.');
}
if (!/export const getTopicWithQuestionsInternal = internalQuery\(/.test(topicsSource)) {
  throw new Error('Expected internal topic-with-questions query for background jobs.');
}

const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');
const conceptActionMatch = aiSource.match(
  /export const generateConceptExerciseForTopic = action\(\{[\s\S]*?\n\}\);/m,
);
if (!conceptActionMatch) {
  throw new Error('generateConceptExerciseForTopic action not found.');
}
if (/\buserId\s*:/.test(conceptActionMatch[0].split('handler:')[0] || '')) {
  throw new Error('generateConceptExerciseForTopic args must not include userId.');
}
if (!/internal\.topics\.getTopicWithQuestionsInternal/.test(conceptActionMatch[0])) {
  throw new Error('Concept generation must read topic data via internal authorized query.');
}
if (!/internal\.concepts\.getUserConceptAttemptsForTopicInternal/.test(conceptActionMatch[0])) {
  throw new Error('Concept generation must load history through internal concept query.');
}

const conceptBuilderSource = await fs.readFile(
  path.join(root, 'src', 'pages', 'ConceptBuilder.jsx'),
  'utf8',
);
if (!/const storageKey = topicId && userId \? `conceptExercise:\$\{userId\}:\$\{topicId\}` : null;/.test(conceptBuilderSource)) {
  throw new Error('Concept cache key must include userId and topicId.');
}
if (!/api\.concepts\.getUserConceptAttempts,\s*userId \? \{\} : 'skip'/s.test(conceptBuilderSource)) {
  throw new Error('Concept attempts query should no longer pass userId from the client.');
}
if (/await createConceptAttempt\(\{[\s\S]*\buserId\s*,/s.test(conceptBuilderSource)) {
  throw new Error('Concept attempt mutation call must not pass userId.');
}
if (/await generateConceptExercise\(\{[\s\S]*\buserId\s*:/s.test(conceptBuilderSource)) {
  throw new Error('Concept generation action call must not pass userId.');
}
if (!/normalize\(result\.userAnswers\[slotIndex\]\) === normalize\(result\.correctAnswers\[slotIndex\]\)/.test(conceptBuilderSource)) {
  throw new Error('Submitted slot correctness must use normalized comparison.');
}

console.log('concept-auth-hardening-regression.test.mjs passed');
