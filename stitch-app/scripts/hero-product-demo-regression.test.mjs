import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEMO_ANSWER,
  DEMO_ANSWER_WORDS,
  DEMO_GENERATE_STAGES,
  DEMO_LESSON,
  DEMO_QUESTION,
  DEMO_TIMING,
  typeDelayForIndex,
} from '../src/components/landing/heroProductDemoScript.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const hook = read('src/components/landing/useHeroProductDemo.js');
const demo = read('src/components/landing/HeroProductDemo.jsx');

assert.equal(DEMO_QUESTION, 'Can you explain working memory in simple terms?');
assert.match(DEMO_ANSWER, /temporary workspace/);
assert.equal(DEMO_LESSON.title, 'Working Memory');
assert.deepEqual(DEMO_LESSON.sections, [
  'What is working memory?',
  'How working memory works',
  'Real-world examples',
  'Quick knowledge check',
]);
assert.equal(DEMO_GENERATE_STAGES.length, 4);
assert.ok(DEMO_ANSWER_WORDS.length >= 30);
assert.ok(typeDelayForIndex(1) >= DEMO_TIMING.typeCharMinMs);
assert.ok(typeDelayForIndex(1) <= DEMO_TIMING.typeCharMaxMs);

const estimatedMs =
  DEMO_TIMING.idleMs +
  DEMO_TIMING.moveToTutorMs +
  DEMO_TIMING.tutorHoverMs +
  DEMO_TIMING.clickMs +
  DEMO_TIMING.tutorOpenMs +
  DEMO_TIMING.moveToComposerMs +
  DEMO_TIMING.clickMs +
  DEMO_QUESTION.length * ((DEMO_TIMING.typeCharMinMs + DEMO_TIMING.typeCharMaxMs) / 2) +
  DEMO_TIMING.afterTypePauseMs +
  280 +
  DEMO_TIMING.clickMs +
  DEMO_TIMING.thinkingMs +
  DEMO_ANSWER_WORDS.length * DEMO_TIMING.streamWordMs +
  DEMO_TIMING.afterAnswerMs +
  DEMO_TIMING.moveToGenerateMs +
  DEMO_TIMING.clickMs +
  DEMO_GENERATE_STAGES.length * DEMO_TIMING.stageMs +
  DEMO_TIMING.lessonRevealMs +
  DEMO_TIMING.lessonHoldMs +
  DEMO_TIMING.resetMs;

assert.ok(estimatedMs >= 14000, `demo loop too short: ${estimatedMs}ms`);
assert.ok(estimatedMs <= 19000, `demo loop too long: ${estimatedMs}ms`);

assert.match(hook, /phase: 'dashboard'/);
assert.match(hook, /openingTutor/);
assert.match(hook, /typingQuestion/);
assert.match(hook, /aiThinking/);
assert.match(hook, /aiResponding/);
assert.match(hook, /generatingLesson/);
assert.match(hook, /lessonComplete/);
assert.match(hook, /cancelled = true/);
assert.match(demo, /IntersectionObserver/);
assert.match(demo, /useReducedMotion/);
assert.match(demo, /lessonComplete/);
assert.doesNotMatch(hook, /\bfetch\s*\(/);
assert.doesNotMatch(demo, /useEveAgent|openai|anthropic|VITE_EVE/);

console.log('hero-product-demo-regression.test.mjs passed');
