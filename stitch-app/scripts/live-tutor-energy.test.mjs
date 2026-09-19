/**
 * Energy helpers for the live-tutor glowing orb.
 *
 * Run: node scripts/live-tutor-energy.test.mjs
 */
import assert from 'node:assert/strict';
import {
    rmsFromFloat32,
    rmsFromPcm,
    voiceLevelFromRms,
} from '../src/lib/liveTutorEnergy.js';

const silence = new Int16Array(2400);
assert.equal(rmsFromPcm(silence), 0);
assert.equal(voiceLevelFromRms(0), 0);

const tone = new Int16Array(4800);
for (let index = 0; index < tone.length; index += 1) {
    tone[index] = Math.round(Math.sin(index / 6) * 22000);
}
assert.ok(rmsFromPcm(tone) > 0.4);
assert.ok(voiceLevelFromRms(rmsFromPcm(tone)) > 0.7);

const quietSpeech = new Float32Array(2400);
for (let index = 0; index < quietSpeech.length; index += 1) {
    quietSpeech[index] = Math.sin(index / 8) * 0.04;
}
assert.ok(rmsFromFloat32(quietSpeech) > 0.02);
assert.ok(voiceLevelFromRms(rmsFromFloat32(quietSpeech)) > 0);

assert.equal(voiceLevelFromRms(0.001), 0);
assert.ok(voiceLevelFromRms(0.2) <= 1);

console.log('live-tutor-energy.test.mjs passed');
