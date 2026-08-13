import assert from 'node:assert/strict';
import { dedupeCourseTopics, isNearDuplicatePrompt, isValidMcq } from '../server/questionDedup.js';
import { normalizeAiCoursePayload } from '../server/aiCourseGeneration.js';

const dupes = [
    {
        prompt: 'What does working memory hold during a study session?',
        options: ['Brief active information', 'Only motor skills', 'Deleted memories', 'No attention'],
        correctIndex: 0,
        explanation: 'Working memory is short-term.',
    },
    {
        prompt: 'What does working memory hold in a study session?',
        options: ['Active information briefly', 'Forever storage', 'Muscle memory only', 'Nothing useful'],
        correctIndex: 0,
        explanation: 'Same idea restated.',
    },
];

assert.equal(isNearDuplicatePrompt(dupes[0].prompt, dupes[1].prompt), true);

const deduped = dedupeCourseTopics([
    {
        title: 'Working memory systems overview',
        content: 'Working memory holds information briefly while long-term memory stores durable knowledge.',
        questions: dupes,
    },
]);
assert.equal(deduped[0].questions.length, 1, 'paraphrased prompts should collapse to one survivor');

assert.equal(
    isValidMcq({
        prompt: 'Which option is correct?',
        options: ['A', 'A', 'B'],
        correctIndex: 0,
    }),
    false,
    'duplicate options must be rejected',
);
assert.equal(
    isValidMcq({
        prompt: 'Which option is correct for this idea?',
        options: ['A', 'B'],
        correctIndex: 4,
    }),
    false,
    'out-of-range correctIndex must be rejected',
);
assert.equal(
    isValidMcq(
        {
            prompt: 'Working memory systems overview explained?',
            options: ['Brief store', 'Forever store'],
            correctIndex: 0,
        },
        { title: 'Working memory systems overview' },
    ),
    false,
    'prompts that restated the topic title must be rejected',
);

const normalized = normalizeAiCoursePayload(
    {
        topics: [
            {
                title: 'Memory systems',
                content:
                    'Working memory holds information briefly while long-term memory stores durable knowledge for later retrieval in study sessions.',
                questions: dupes,
            },
        ],
    },
    { fileName: 'memory.pdf', extractedText: 'fallback' },
);
assert.equal(normalized.topics[0].questions.filter((q) => q.questionType !== 'ordering').length, 1);

console.log('question-dedup-regression.test.mjs passed');
