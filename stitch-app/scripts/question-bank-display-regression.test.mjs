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
        usableEssayCount: 4,
    }),
    'Essay Quiz'
);
assert.equal(
    formatEssayQuizButtonLabel({
        startingExam: false,
        usableEssayCount: 4,
    }),
    'Essay Quiz'
);
assert.equal(
    formatEssayPreparingMessage(4),
    'Essay questions will finish generating when you start the exam. 4 essay questions ready so far.'
);
assert.equal(
    formatEssayPreparingMessage(0),
    'Essay questions will generate when you start the exam. The first run can take 10-20 seconds.'
);
assert.equal(
    formatQuestionBankProgressMessage({
        usableObjectiveCount: 0,
        usableEssayCount: 0,
        objectiveReady: false,
        examReady: false,
    }),
    'Questions are generated when you start an exam. The first run usually takes 10-20 seconds.'
);
assert.equal(
    formatQuestionBankProgressMessage({
        usableObjectiveCount: 3,
        usableEssayCount: 4,
        objectiveReady: false,
        examReady: false,
    }),
    '3 objective questions ready and 4 essay questions ready so far. Missing questions will finish when you start an exam.'
);
assert.equal(
    formatQuestionBankProgressMessage({
        usableObjectiveCount: 5,
        usableEssayCount: 1,
        objectiveReady: true,
        examReady: false,
    }),
    'Objective ready. 1 essay question ready so far. Missing essays will finish when you start the exam.'
);

console.log('question-bank-display-regression: ok');
