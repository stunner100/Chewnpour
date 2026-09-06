import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STUDY_ANSWER,
  STUDY_ANSWER_WORDS,
  STUDY_EXAMPLE,
  STUDY_EXAMPLE_WORDS,
  STUDY_HIGHLIGHT,
  STUDY_LESSON_BODY,
  STUDY_MINI_OPTIONS,
  STUDY_QUESTION,
  STUDY_QUIZ,
  STUDY_TIMING,
} from '../src/components/landing/lessonStudyDemoScript.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const hook = read('src/components/landing/useLessonStudyDemo.js');
const demo = read('src/components/landing/LessonStudyDemo.jsx');
const landing = read('src/pages/LandingPage.jsx');
const preview = read('src/components/landing/LandingProductPreviews.jsx');
const runtime = read('src/components/landing/landingDemoRuntime.js');
const shared = read('src/components/landing/landingDemoShared.jsx');

assert.match(STUDY_LESSON_BODY, new RegExp(STUDY_HIGHLIGHT));
assert.equal(STUDY_QUESTION, 'Explain this in simpler terms');
assert.match(STUDY_ANSWER, /small desk in your mind/);
assert.match(STUDY_EXAMPLE, /27 \+ 18/);
assert.equal(STUDY_MINI_OPTIONS.length, 3);
assert.equal(STUDY_QUIZ.options.length, 4);
assert.match(STUDY_QUIZ.progress, /Question 1 of 5/);

assert.match(landing, /Never get stuck while studying/);
assert.match(landing, /LandingLessonPreview/);
assert.match(preview, /LessonStudyDemo/);
assert.match(shared, /export function DemoCursor/);
assert.match(runtime, /IntersectionObserver/);
assert.match(demo, /useDemoInView\(0\.45/);
assert.match(demo, /useReducedMotion/);
assert.match(demo, /Ask from this lesson, not the open web/);
assert.match(hook, /phase: 'lessonIdle'/);
assert.match(hook, /selectingText/);
assert.match(hook, /askingTutor/);
assert.match(hook, /miniQuiz/);
assert.match(hook, /quizReady/);
assert.match(hook, /cancelled = true/);
assert.doesNotMatch(hook, /\bfetch\s*\(/);
assert.doesNotMatch(demo, /useEveAgent|openai|anthropic/);

const estimatedMs =
  STUDY_TIMING.idleMs +
  STUDY_TIMING.moveToPhraseMs +
  STUDY_TIMING.selectMs +
  STUDY_TIMING.askRevealMs +
  STUDY_TIMING.moveToAskMs +
  STUDY_TIMING.clickMs +
  STUDY_TIMING.tutorOpenMs +
  STUDY_QUESTION.length * ((STUDY_TIMING.typeCharMinMs + STUDY_TIMING.typeCharMaxMs) / 2) +
  STUDY_TIMING.afterTypePauseMs +
  STUDY_TIMING.moveToSendMs +
  STUDY_TIMING.clickMs +
  STUDY_TIMING.thinkingMs +
  STUDY_ANSWER_WORDS.length * STUDY_TIMING.streamWordMs +
  STUDY_TIMING.examplePauseMs +
  STUDY_EXAMPLE_WORDS.length * STUDY_TIMING.streamWordMs +
  STUDY_TIMING.afterAnswerMs +
  STUDY_TIMING.moveToTestMs +
  STUDY_TIMING.clickMs +
  STUDY_TIMING.miniPauseMs +
  STUDY_TIMING.moveToChoiceBMs +
  STUDY_TIMING.clickMs +
  STUDY_TIMING.selectAnswerMs +
  STUDY_TIMING.correctHoldMs +
  STUDY_TIMING.moveToQuizMs +
  STUDY_TIMING.clickMs +
  STUDY_TIMING.quizHoldMs +
  STUDY_TIMING.resetMs;

assert.ok(estimatedMs >= 12000, `study demo too short: ${estimatedMs}ms`);
assert.ok(estimatedMs <= 16000, `study demo too long: ${estimatedMs}ms`);
assert.ok(STUDY_TIMING.typeCharMinMs < STUDY_TIMING.typeCharMaxMs);

console.log('lesson-study-demo-regression.test.mjs passed');
