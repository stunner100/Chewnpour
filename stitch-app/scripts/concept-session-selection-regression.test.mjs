import assert from 'node:assert/strict';
import {
  buildConceptSessionItems,
  dedupeConceptExercises,
  extractAttemptedConceptExerciseKeys,
  summarizeConceptExerciseBank,
} from '../convex/lib/conceptSessionSelection.js';
import { buildConceptExerciseKey } from '../convex/lib/conceptExerciseGeneration.js';

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

const wholeCloze = clozeExercise(
  'A fraction represents __ of a whole.',
  'fraction_whole',
  'part',
  ['part', 'sum', 'denominator'],
  'easy',
);

const numeratorDefinition = choiceExercise(
  'definition_match',
  'Which meaning best matches the term numerator?',
  'numerator',
  'The count of selected parts',
  [
    'The count of selected parts',
    'The size of the denominator only',
    'The number of pages in the source',
  ],
  'easy',
);

const denominatorMisconception = choiceExercise(
  'misconception_check',
  'A classmate says denominators should always be added together. Which correction matches the lesson?',
  'fraction_addition',
  'Keep the denominator when the fractions already share it',
  [
    'Keep the denominator when the fractions already share it',
    'Add denominators first, then simplify later',
    'Ignore the numerator and only compare denominators',
  ],
  'medium',
);

const equivalentCloze = clozeExercise(
  'Equivalent fractions name the same value using different __.',
  'equivalent_fractions',
  'numbers',
  ['numbers', 'volumes', 'slides'],
  'medium',
);

const simplifyDefinition = choiceExercise(
  'definition_match',
  'Which explanation best matches simplifying a fraction?',
  'simplify_fraction',
  'Rewriting the fraction in a smaller but equal form',
  [
    'Rewriting the fraction in a smaller but equal form',
    'Changing the denominator to any new number',
    'Adding one to both the numerator and denominator',
  ],
  'hard',
);

const duplicateSimplifyDefinition = {
  ...simplifyDefinition,
  options: [
    { id: 'dup-1', text: 'Rewriting the fraction in a smaller but equal form' },
    { id: 'dup-2', text: 'Making the fraction longer' },
    { id: 'dup-3', text: 'Converting every fraction to a decimal' },
  ],
};

const sessionAttempt = {
  answers: {
    items: [
      {
        exerciseKey: buildConceptExerciseKey(numeratorDefinition, { includeTemplate: false }),
        exerciseType: numeratorDefinition.exerciseType,
        conceptKey: numeratorDefinition.conceptKey,
        questionText: numeratorDefinition.questionText,
        correctAnswers: numeratorDefinition.answers,
        options: numeratorDefinition.options,
        correctOptionId: numeratorDefinition.correctOptionId,
      },
    ],
  },
};

const legacyAttempt = {
  questionText: wholeCloze.questionText,
  answers: {
    correctAnswers: wholeCloze.answers,
  },
};

const deduped = dedupeConceptExercises([
  wholeCloze,
  numeratorDefinition,
  denominatorMisconception,
  equivalentCloze,
  simplifyDefinition,
  duplicateSimplifyDefinition,
]);

assert.equal(deduped.length, 5, 'duplicate mixed-type bank items should collapse to one exercise');

const bankSummary = summarizeConceptExerciseBank(deduped);
assert.equal(bankSummary.activeCount, 5, 'bank summary should count active deduped exercises');
assert.equal(bankSummary.exerciseTypeCount, 3, 'bank summary should track all supported exercise types');
assert.equal(bankSummary.conceptKeyCount, 5, 'bank summary should track concept-key diversity');

const attemptedKeys = extractAttemptedConceptExerciseKeys([legacyAttempt, sessionAttempt]);
assert.equal(attemptedKeys.length, 2, 'legacy and session attempts should both contribute mixed-type keys');

const sessionItems = buildConceptSessionItems({
  bankExercises: deduped,
  attempts: [legacyAttempt, sessionAttempt],
  sessionSize: 5,
});

assert.equal(sessionItems.length, 5, 'session selection should fill the requested session size');
assert.deepEqual(
  new Set(sessionItems.slice(0, 3).map((item) => item.exerciseType)),
  new Set(['cloze', 'definition_match', 'misconception_check']),
  'the first selection pass should prioritize exercise-type diversity among unseen prompts',
);
assert.ok(
  sessionItems.some((item) => item.questionText === wholeCloze.questionText),
  'attempted cloze prompts should still remain available as fallback once unseen prompts are used up',
);
assert.ok(
  sessionItems.some((item) => item.questionText === numeratorDefinition.questionText),
  'attempted choice prompts should still remain available as fallback once unseen prompts are used up',
);
assert.ok(
  sessionItems.every((item) => typeof item.conceptKey === 'string' && item.conceptKey.length > 0),
  'selected prompts should preserve concept keys for downstream review tracking',
);

console.log('concept-session-selection-regression: ok');
