import assert from 'node:assert/strict';
import {
  buildConceptExerciseKey,
  deriveConceptKey,
  getConceptExerciseCorrectAnswers,
  normalizeConceptDifficulty,
  normalizeConceptExerciseType,
} from '../convex/lib/conceptExerciseGeneration.js';

assert.equal(normalizeConceptExerciseType('match term to meaning'), 'definition_match');
assert.equal(normalizeConceptExerciseType('misconception'), 'misconception_check');
assert.equal(normalizeConceptExerciseType(undefined), 'cloze');

assert.equal(normalizeConceptDifficulty('HARD'), 'hard');
assert.equal(normalizeConceptDifficulty('introductory'), 'medium');

assert.equal(
  deriveConceptKey('', 'Equivalent Fractions', 'Fractions'),
  'equivalent_fractions',
  'concept key should fall back to the first meaningful concept label',
);

const clozeKey = buildConceptExerciseKey({
  exerciseType: 'cloze',
  questionText: 'Equivalent fractions name the same value using different __.',
  conceptKey: 'equivalent_fractions',
  template: ['Equivalent fractions name the same value using different ', '__', '.'],
  answers: ['numbers'],
});

const choiceKey = buildConceptExerciseKey({
  exerciseType: 'definition_match',
  questionText: 'Which meaning best matches the term numerator?',
  conceptKey: 'numerator',
  options: [
    { id: 'a', text: 'The count of selected parts' },
    { id: 'b', text: 'The size of the denominator only' },
    { id: 'c', text: 'The number of pages in the source' },
  ],
  correctOptionId: 'a',
  answers: ['The count of selected parts'],
});

assert.notEqual(clozeKey, choiceKey, 'exercise keys should separate cloze and choice prompts');
assert.deepEqual(
  getConceptExerciseCorrectAnswers({
    exerciseType: 'definition_match',
    options: [
      { id: 'a', text: 'The count of selected parts' },
      { id: 'b', text: 'The size of the denominator only' },
    ],
    correctOptionId: 'a',
  }),
  ['the count of selected parts'],
  'choice prompts should resolve the correct option text through correctOptionId',
);

console.log('concept-exercise-normalization-regression: ok');
