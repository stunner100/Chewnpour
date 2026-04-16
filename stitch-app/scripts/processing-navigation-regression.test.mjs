import assert from 'node:assert/strict';
import {
    shouldAutoNavigateFromProcessing,
    shouldShowProcessingConfirmation,
} from '../src/lib/processingNavigation.js';

const baseUpload = {
    status: 'processing',
    processingStep: 'extracting',
    generatedTopicCount: 0,
};

assert.equal(
    shouldAutoNavigateFromProcessing({
        upload: baseUpload,
        hasTopics: false,
        autoNavigated: false,
        resolvedCourseId: 'course_1',
    }),
    false
);

assert.equal(
    shouldAutoNavigateFromProcessing({
        upload: { ...baseUpload, processingStep: 'first_topic_ready', generatedTopicCount: 1 },
        hasTopics: false,
        autoNavigated: false,
        resolvedCourseId: 'course_1',
    }),
    true
);

assert.equal(
    shouldAutoNavigateFromProcessing({
        upload: { ...baseUpload, status: 'ready' },
        hasTopics: false,
        autoNavigated: false,
        resolvedCourseId: 'course_1',
    }),
    false
);

assert.equal(
    shouldAutoNavigateFromProcessing({
        upload: { ...baseUpload, status: 'ready', generatedTopicCount: 1, processingStep: 'ready' },
        hasTopics: false,
        autoNavigated: false,
        resolvedCourseId: 'course_1',
    }),
    true
);

assert.equal(
    shouldAutoNavigateFromProcessing({
        upload: { ...baseUpload, status: 'ready' },
        hasTopics: true,
        autoNavigated: true,
        resolvedCourseId: 'course_1',
    }),
    false
);

assert.equal(
    shouldShowProcessingConfirmation({
        upload: { ...baseUpload, status: 'ready', generatedTopicCount: 0, processingStep: 'ready' },
        hasTopics: false,
    }),
    false
);

assert.equal(
    shouldShowProcessingConfirmation({
        upload: { ...baseUpload, status: 'ready', generatedTopicCount: 1, processingStep: 'ready' },
        hasTopics: false,
    }),
    true
);

assert.equal(
    shouldShowProcessingConfirmation({
        upload: { ...baseUpload, status: 'error' },
        hasTopics: false,
    }),
    false
);

console.log('processing-navigation-regression tests passed');
