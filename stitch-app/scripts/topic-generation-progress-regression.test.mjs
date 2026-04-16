import assert from 'node:assert/strict';
import {
    calculateRemainingTopicProgress,
    clampGeneratedTopicCount,
    normalizeGeneratedTopicCount,
} from '../convex/lib/topicGenerationProgress.js';

assert.equal(
    clampGeneratedTopicCount({ generatedTopicCount: 0, totalTopics: 5 }),
    0
);
assert.equal(
    clampGeneratedTopicCount({ generatedTopicCount: 7, totalTopics: 5 }),
    5
);
assert.equal(
    clampGeneratedTopicCount({ generatedTopicCount: 2, totalTopics: 0 }),
    0
);

assert.equal(
    normalizeGeneratedTopicCount({ generatedTopicCount: 0, totalTopics: 5 }),
    1
);
assert.equal(
    normalizeGeneratedTopicCount({ generatedTopicCount: 7, totalTopics: 5 }),
    5
);
assert.equal(
    normalizeGeneratedTopicCount({ generatedTopicCount: 2, totalTopics: 0 }),
    0
);

assert.equal(
    calculateRemainingTopicProgress({ generatedTopicCount: 1, totalTopics: 5 }),
    60
);
assert.equal(
    calculateRemainingTopicProgress({ generatedTopicCount: 3, totalTopics: 5 }),
    72
);
assert.equal(
    calculateRemainingTopicProgress({ generatedTopicCount: 5, totalTopics: 5 }),
    85
);
assert.equal(
    calculateRemainingTopicProgress({ generatedTopicCount: 1, totalTopics: 1 }),
    60
);

console.log('topic-generation-progress-regression tests passed');
