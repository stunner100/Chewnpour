/**
 * Word reveal for live-tutor captions, synced to PCM playback progress.
 *
 * Run: node scripts/live-tutor-captions.test.mjs
 */
import assert from 'node:assert/strict';
import { revealedCaption } from '../src/lib/liveTutorCaptions.js';

const sentence = 'What is the purpose of working memory in this lesson?';

assert.equal(revealedCaption('', 0.5), '');
assert.equal(revealedCaption(sentence, 0), '');
assert.equal(revealedCaption(sentence, 0, 'held'), 'held');
assert.equal(revealedCaption(sentence, 1), sentence);

const halfway = revealedCaption(sentence, 0.5);
assert.equal(halfway, 'What is the purpose of');
assert.ok(halfway.split(/\s+/).length < sentence.split(/\s+/).length);

assert.equal(
    revealedCaption(sentence, 0.2, 'What is the purpose of working'),
    'What is the purpose of working',
    'revealed words must never shrink if later audio stretches the utterance',
);

assert.equal(
    revealedCaption('  What   is memory?  ', 1),
    'What is memory?',
);

console.log('live-tutor-captions.test.mjs passed');
