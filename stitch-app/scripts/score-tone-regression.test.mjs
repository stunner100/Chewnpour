import { getScoreTone } from '../src/lib/scoreTone.js';

const successTone = getScoreTone(85);
if (successTone.textClass !== 'text-success' || successTone.barClass !== 'bg-success') {
    throw new Error('getScoreTone should map high scores to success tokens.');
}

console.log('score-tone-regression.test.mjs passed');
