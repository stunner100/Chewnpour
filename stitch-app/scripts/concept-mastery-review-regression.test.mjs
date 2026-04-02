import assert from 'node:assert/strict';
import {
  buildConceptMasterySummary,
  buildConceptMasteryUpdates,
} from '../convex/lib/conceptMastery.js';
import { buildConceptSessionItems } from '../convex/lib/conceptSessionSelection.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const clozeExercise = (questionText, conceptKey, answer, tokens, difficulty = 'easy') => ({
  exerciseType: 'cloze',
  conceptKey,
  difficulty,
  questionText,
  template: ['Concept check: ', '__'],
  answers: [answer],
  tokens,
});

const choiceExercise = (exerciseType, questionText, conceptKey, correctText, options, difficulty = 'medium') => ({
  exerciseType,
  conceptKey,
  difficulty,
  questionText,
  options: options.map((text, index) => ({ id: `option-${index + 1}`, text })),
  correctOptionId: `option-${options.findIndex((text) => text === correctText) + 1}`,
  answers: [correctText],
});

const now = Date.UTC(2026, 3, 2, 12, 0, 0);

const existingRecords = [
  {
    _id: 'mastery-numerator',
    conceptKey: 'numerator',
    conceptLabel: 'Numerator',
    strength: 88,
    status: 'strong',
    correctStreak: 2,
    attemptsCount: 2,
    correctCount: 2,
    questionCount: 2,
    lastAccuracy: 100,
    lastExerciseType: 'definition_match',
    lastQuestionText: 'Which meaning best matches the term numerator?',
    lastPracticedAt: now - DAY_MS,
    nextReviewAt: now - HOUR_MS,
    updatedAt: now - DAY_MS,
  },
];

const sessionItems = [
  {
    conceptKey: 'numerator',
    exerciseType: 'definition_match',
    questionText: 'Which meaning best matches the term numerator?',
    score: 1,
    total: 1,
  },
  {
    conceptKey: 'equivalent_fractions',
    exerciseType: 'cloze',
    questionText: 'Equivalent fractions name the same value using different __.',
    score: 0,
    total: 1,
  },
];

const updates = buildConceptMasteryUpdates({
  existingRecords,
  sessionItems,
  topicId: 'topic-1',
  userId: 'user-1',
  now,
});

assert.equal(updates.length, 2, 'one mastery update should be produced per practiced concept');

const numeratorUpdate = updates.find((update) => update.conceptKey === 'numerator');
assert.ok(numeratorUpdate, 'existing mastery rows should be patched in place');
assert.equal(numeratorUpdate.existingId, 'mastery-numerator');
assert.equal(numeratorUpdate.correctStreak, 3, 'perfect follow-up answers should extend the streak');
assert.equal(numeratorUpdate.status, 'strong');
assert.equal(numeratorUpdate.attemptsCount, 3);
assert.equal(numeratorUpdate.correctCount, 3);
assert.equal(numeratorUpdate.questionCount, 3);
assert.equal(numeratorUpdate.strength, 95, 'strength should be smoothed toward the latest observed accuracy');
assert.equal(
  numeratorUpdate.nextReviewAt,
  now + (7 * DAY_MS),
  'strong concepts with a multi-session streak should review on a longer interval',
);

const equivalentUpdate = updates.find((update) => update.conceptKey === 'equivalent_fractions');
assert.ok(equivalentUpdate, 'newly practiced concepts should create mastery rows');
assert.equal(equivalentUpdate.existingId, null);
assert.equal(equivalentUpdate.status, 'weak');
assert.equal(equivalentUpdate.correctStreak, 0);
assert.equal(equivalentUpdate.lastAccuracy, 0);
assert.equal(
  equivalentUpdate.nextReviewAt,
  now + (12 * HOUR_MS),
  'weak concepts should be scheduled back quickly',
);

const summary = buildConceptMasterySummary({
  records: [
    numeratorUpdate,
    {
      ...equivalentUpdate,
      nextReviewAt: now - HOUR_MS,
    },
  ],
  now,
});

assert.equal(summary.totalConcepts, 2);
assert.equal(summary.dueCount, 1, 'due concepts should be counted explicitly');
assert.deepEqual(
  summary.reviewConceptKeys,
  ['equivalent_fractions'],
  'focused review should prioritize due concepts before all others',
);
assert.equal(summary.items[0].conceptKey, 'equivalent_fractions', 'due weak concepts should sort to the front');
assert.equal(summary.items[0].due, true);

const focusBank = [
  clozeExercise(
    'Equivalent fractions name the same value using different __.',
    'equivalent_fractions',
    'numbers',
    ['numbers', 'pages', 'angles'],
    'easy',
  ),
  choiceExercise(
    'definition_match',
    'Which meaning best matches the term numerator?',
    'numerator',
    'The count of selected parts',
    [
      'The count of selected parts',
      'The size of the denominator only',
      'The number of pages in the source',
    ],
    'medium',
  ),
  choiceExercise(
    'misconception_check',
    'A denominator tells you how many equal parts the whole was split into.',
    'denominator',
    'The denominator counts the equal parts in the whole',
    [
      'The denominator counts the equal parts in the whole',
      'The denominator counts only the shaded parts',
      'The denominator is always larger than the numerator',
    ],
    'easy',
  ),
];

const focusedSession = buildConceptSessionItems({
  bankExercises: focusBank,
  attempts: [],
  sessionSize: 2,
  focusConceptKeys: ['equivalent_fractions', 'numerator'],
});

assert.equal(focusedSession.length, 2);
assert.deepEqual(
  new Set(focusedSession.map((item) => item.conceptKey)),
  new Set(['equivalent_fractions', 'numerator']),
  'review sessions should prefer the requested weak concepts when enough prompts exist',
);

console.log('concept-mastery-review-regression: ok');
