/**
 * Word reveal for live-tutor captions, synced to PCM playback progress.
 *
 * Run: node scripts/live-tutor-captions.test.mjs
 */
import assert from 'node:assert/strict';
import { questionProgress, questionSegments, revealedCaption } from '../src/lib/liveTutorCaptions.js';

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

// questionSegments: split tutor utterances into one line per question
assert.deepEqual(questionSegments(''), []);
assert.deepEqual(
    questionSegments('What is working memory? It keeps ideas handy.'),
    ['What is working memory? It keeps ideas handy.'],
    'a question plus its follow-up stays one line',
);
assert.deepEqual(
    questionSegments('Good. What is working memory? And why does it matter?'),
    ['Good. What is working memory?', 'And why does it matter?'],
    'multi-question turns split per question',
);
assert.deepEqual(
    questionSegments('Recap: you covered encoding and retrieval. Now take the quiz below.'),
    ['Recap: you covered encoding and retrieval. Now take the quiz below.'],
    'a recap without question marks stays a single line',
);
assert.deepEqual(
    questionSegments('Quick check?'),
    [],
    'noise section titles must not count as questions',
);

// questionProgress: derive "Question n of total" from a transcript
assert.equal(questionProgress([], 5), null, 'no progress before the first turn');
assert.equal(questionProgress([], 0), null, 'no target means no progress chip');
assert.deepEqual(
    questionProgress(
        [{ role: 'assistant', text: 'What is working memory?' }],
        5,
    ),
    { asked: 1, answered: 0, current: 1, total: 5 },
);
assert.deepEqual(
    questionProgress(
        [
            { role: 'assistant', text: 'What is working memory?' },
            { role: 'user', text: 'Short-term storage for ideas.' },
            { role: 'assistant', text: 'Nice. Why does it matter?' },
        ],
        5,
    ),
    { asked: 2, answered: 1, current: 2, total: 5 },
);
assert.deepEqual(
    questionProgress(
        [
            { role: 'assistant', text: 'Q1? Q2? Q3? Q4? Q5? Q6? Q7?' },
            { role: 'user', text: 'answer' },
        ],
        5,
    ),
    { asked: 5, answered: 1, current: 5, total: 5 },
    'question counts clamp to the session target',
);

console.log('live-tutor-captions.test.mjs passed');
