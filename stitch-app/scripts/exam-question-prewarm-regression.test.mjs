import assert from 'node:assert/strict';
import {
    EXAM_PREWARM_MIN_QUESTION_COUNT,
    shouldPrewarmExamQuestions,
} from '../src/lib/examQuestionPrewarm.js';

const baseTopic = { _id: 'topic_1', title: 'Topic 1' };

assert.equal(
    EXAM_PREWARM_MIN_QUESTION_COUNT,
    30,
    'Expected prewarm minimum question threshold to be 30.'
);

assert.equal(
    shouldPrewarmExamQuestions({
        topicId: null,
        topicData: baseTopic,
        questionCount: 0,
        alreadyTriggered: false,
    }),
    false
);

assert.equal(
    shouldPrewarmExamQuestions({
        topicId: 'topic_1',
        topicData: undefined,
        questionCount: 0,
        alreadyTriggered: false,
    }),
    false
);

assert.equal(
    shouldPrewarmExamQuestions({
        topicId: 'topic_1',
        topicData: baseTopic,
        questionCount: EXAM_PREWARM_MIN_QUESTION_COUNT - 1,
        alreadyTriggered: false,
    }),
    true
);

assert.equal(
    shouldPrewarmExamQuestions({
        topicId: 'topic_1',
        topicData: baseTopic,
        questionCount: EXAM_PREWARM_MIN_QUESTION_COUNT,
        alreadyTriggered: false,
    }),
    false
);

assert.equal(
    shouldPrewarmExamQuestions({
        topicId: 'topic_1',
        topicData: baseTopic,
        questionCount: 3,
        alreadyTriggered: true,
    }),
    false
);

console.log('exam-question-prewarm-regression tests passed');
