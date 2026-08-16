import assert from 'node:assert/strict';
import { hintLeaksAnswer, sanitizeGeneratedHint } from '../server/hintSanitize.js';

assert.equal(
    hintLeaksAnswer({
        hint: 'Choose working memory because it holds information briefly',
        questionType: 'multiple_choice',
        options: ['holds information briefly', 'stores only motor skills', 'deletes memories'],
        correctIndex: 0,
    }),
    true,
);

assert.equal(
    hintLeaksAnswer({
        hint: 'The unique term mitochondria is the giveaway.',
        questionType: 'multiple_choice',
        options: ['mitochondria produce ATP', 'the nucleus stores fat', 'ribosomes store light'],
        correctIndex: 0,
    }),
    true,
);

assert.equal(
    hintLeaksAnswer({
        hint: 'The statement is true based on the lecture.',
        questionType: 'true_false',
        answer: true,
    }),
    true,
);

assert.equal(
    hintLeaksAnswer({
        hint: 'First mix the reagents, then heat the sample, finally record the pH.',
        questionType: 'ordering',
        stepsInOrder: ['mix the reagents', 'heat the sample', 'record the pH'],
    }),
    true,
);

const safe = sanitizeGeneratedHint({
    hint: 'Compare the time scale described in the lesson.',
    questionType: 'multiple_choice',
    options: ['holds information briefly', 'stores only motor skills'],
    correctIndex: 0,
});
assert.equal(safe.includes('Compare the time scale'), true);

const leaked = sanitizeGeneratedHint({
    hint: 'The answer is holds information briefly',
    questionType: 'multiple_choice',
    options: ['holds information briefly', 'stores only motor skills'],
    correctIndex: 0,
});
assert.equal(leaked.includes('holds information briefly'), false);

console.log('hint-sanitize-regression.test.mjs passed');
