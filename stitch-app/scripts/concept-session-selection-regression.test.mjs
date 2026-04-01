import assert from 'node:assert/strict';
import {
  buildConceptSessionItems,
  dedupeConceptExercises,
  extractAttemptedConceptExerciseKeys,
} from '../convex/lib/conceptSessionSelection.js';
import { buildConceptExerciseKey } from '../convex/lib/conceptExerciseGeneration.js';

const exercise = (questionText, answers, template = ['Explain ', '__'], tokens = answers) => ({
  questionText,
  answers,
  template,
  tokens,
});

const introExercise = exercise(
  'Artificial intelligence helps machines perform tasks that usually need __.',
  ['human intelligence'],
  ['Artificial intelligence helps machines perform tasks that usually need ', '__', '.'],
  ['human intelligence', 'computer chips', 'electricity']
);

const mlExercise = exercise(
  'Machine learning improves predictions by finding __ in data.',
  ['patterns'],
  ['Machine learning improves predictions by finding ', '__', ' in data.'],
  ['patterns', 'paint', 'microphones']
);

const dataExercise = exercise(
  'Training data should include enough __ to reflect real examples.',
  ['variety'],
  ['Training data should include enough ', '__', ' to reflect real examples.'],
  ['variety', 'silence', 'heat']
);

const biasExercise = exercise(
  'Bias in a dataset can lead to unfair __.',
  ['outcomes'],
  ['Bias in a dataset can lead to unfair ', '__', '.'],
  ['outcomes', 'keyboards', 'batteries']
);

const modelExercise = exercise(
  'A model improves when feedback is used to update its __.',
  ['parameters'],
  ['A model improves when feedback is used to update its ', '__', '.'],
  ['parameters', 'stickers', 'screens']
);

const evalExercise = exercise(
  'Evaluation checks whether the model generalizes to new __.',
  ['examples'],
  ['Evaluation checks whether the model generalizes to new ', '__', '.'],
  ['examples', 'printers', 'cables']
);

const duplicateIntroExercise = {
  ...introExercise,
  tokens: ['human intelligence', 'robots', 'paint'],
};

const sessionAttempt = {
  answers: {
    items: [
      {
        exerciseKey: buildConceptExerciseKey(mlExercise, { includeTemplate: false }),
        questionText: mlExercise.questionText,
        correctAnswers: mlExercise.answers,
      },
    ],
  },
};

const legacyAttempt = {
  questionText: introExercise.questionText,
  answers: {
    correctAnswers: introExercise.answers,
  },
};

const deduped = dedupeConceptExercises([
  introExercise,
  duplicateIntroExercise,
  mlExercise,
  dataExercise,
  biasExercise,
  modelExercise,
  evalExercise,
]);

assert.equal(deduped.length, 6, 'duplicate bank items should collapse to one exercise');

const attemptedKeys = extractAttemptedConceptExerciseKeys([legacyAttempt, sessionAttempt]);
assert.equal(attemptedKeys.length, 2, 'legacy and session attempts should both contribute keys');

const sessionItems = buildConceptSessionItems({
  bankExercises: deduped,
  attempts: [legacyAttempt, sessionAttempt],
  sessionSize: 5,
});

assert.equal(sessionItems.length, 5, 'session selection should fill the requested session size');
assert.equal(
  sessionItems[0].questionText,
  dataExercise.questionText,
  'unseen exercises should be prioritized ahead of attempted ones'
);
assert.ok(
  sessionItems.some((item) => item.questionText === introExercise.questionText),
  'attempted exercises should still be available as fallback once unseen items are exhausted'
);

console.log('concept-session-selection-regression: ok');
