import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { getConceptSessionLoadingState } from '../src/lib/conceptLoadingEta.js';

const conceptBuilder = await fs.readFile(
  new URL('../src/pages/ConceptBuilder.jsx', import.meta.url),
  'utf8',
);

const initialState = getConceptSessionLoadingState({ elapsedMs: 0, focusedReview: false });
assert.equal(initialState.stageLabel, 'Grounding your source', 'fresh sessions should start by grounding the source');
assert.equal(initialState.etaLabel, 'About 28s left', 'fresh sessions should expose an initial ETA');
assert.equal(initialState.steps[0].status, 'active', 'the first loading step should start active');

const midState = getConceptSessionLoadingState({ elapsedMs: 12000, focusedReview: false });
assert.equal(midState.stageLabel, 'Drafting concept checks', 'mid-session loads should move into drafting');
assert.equal(midState.steps[0].status, 'complete', 'earlier steps should complete once the load advances');
assert.equal(midState.steps[1].status, 'active', 'the drafting step should become active');

const lateReviewState = getConceptSessionLoadingState({ elapsedMs: 15000, focusedReview: true });
assert.equal(lateReviewState.stageLabel, 'Assembling your session', 'focused review loads should reach assembly sooner');
assert.match(lateReviewState.helperLabel, /10-20 seconds/, 'focused review should advertise the shorter time window');

const delayedState = getConceptSessionLoadingState({ elapsedMs: 38000, focusedReview: false });
assert.equal(delayedState.etaLabel, 'Taking longer than usual, still generating', 'long-running loads should acknowledge the delay');
assert.ok(delayedState.progressPercent <= 96, 'estimated progress should not claim full completion before the session resolves');

assert.match(
  conceptBuilder,
  /ETA/,
  'concept builder should expose an ETA label while the session is preparing',
);
assert.match(
  conceptBuilder,
  /Preparing concept practice/,
  'concept builder should retain a clear loading headline',
);
assert.match(
  conceptBuilder,
  /complete<\/span>/,
  'concept builder should show progress copy while concept practice is preparing',
);

console.log('concept-loading-eta-regression: ok');
