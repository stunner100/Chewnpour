import { resolveQuestionOptions } from '../src/lib/examQuestionOptions.js';
import { getScoreTone } from '../src/lib/scoreTone.js';
import {
    getConvexErrorCode,
    resolveConvexActionError,
} from '../src/lib/convexClientErrors.js';

const malformedStringOptions = [
    '{"label":"A","text":"First choice","isCorrect":false}',
    '{"label":"B","text":"Second choice","isCorrect":true}',
];

const resolved = resolveQuestionOptions(malformedStringOptions);
if (resolved.length !== 2) {
    throw new Error(`Expected 2 resolved options, got ${resolved.length}`);
}
if (resolved[0]?.text !== 'First choice' || resolved[1]?.text !== 'Second choice') {
    throw new Error('Malformed fragment options were not reconstructed correctly.');
}

const letterPrefixed = resolveQuestionOptions(['A) Photosynthesis', 'B) Respiration']);
if (letterPrefixed[0]?.label !== 'A' || letterPrefixed[0]?.text !== 'Photosynthesis') {
    throw new Error('Letter-prefixed string options were not normalized correctly.');
}

const successTone = getScoreTone(85);
if (successTone.textClass !== 'text-success' || successTone.barClass !== 'bg-success') {
    throw new Error('getScoreTone should map high scores to success tokens.');
}

const wrappedError = {
    message: '[CONVEX A] [Request ID: abc] Uncaught Error: must be signed in',
};
const message = resolveConvexActionError(wrappedError, 'fallback');
if (!message.toLowerCase().includes('must be signed in')) {
    throw new Error('resolveConvexActionError should unwrap Convex client errors.');
}
if (getConvexErrorCode(wrappedError) !== 'UNAUTHENTICATED') {
    throw new Error('getConvexErrorCode should infer auth codes from unwrapped messages.');
}

console.log('exam-question-options-regression.test.mjs passed');
