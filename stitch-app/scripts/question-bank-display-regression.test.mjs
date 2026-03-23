import assert from 'node:assert/strict';

import {
    formatEssayPreparingMessage,
    formatEssayQuizButtonLabel,
    formatQuestionBankProgressMessage,
    formatReadyCount,
} from '../src/lib/questionBankDisplay.js';

assert.equal(formatReadyCount(4, 'essay question'), '4 essay questions ready');
assert.equal(
    formatEssayQuizButtonLabel({
        startingExam: false,
        essayReady: false,
        usableEssayCount: 4,
    }),
    'Essay (4 ready)'
);
assert.equal(
    formatEssayQuizButtonLabel({
        startingExam: false,
        essayReady: true,
        usableEssayCount: 4,
    }),
    'Essay Quiz'
);
assert.equal(
    formatEssayPreparingMessage(4),
    'Essay questions are still preparing. 4 essay questions ready so far. Please check back in a moment.'
);
assert.equal(
    formatQuestionBankProgressMessage({
        usableMcqCount: 3,
        usableEssayCount: 4,
        mcqReady: false,
        examReady: false,
    }),
    '3 MCQs ready and 4 essay questions ready so far.'
);
assert.equal(
    formatQuestionBankProgressMessage({
        usableMcqCount: 5,
        usableEssayCount: 1,
        mcqReady: true,
        examReady: false,
    }),
    'MCQ ready. 1 essay question ready so far.'
);

console.log('question-bank-display-regression: ok');
