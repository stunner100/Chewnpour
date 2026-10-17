// The client's reading of background generation: which parts are written,
// being written, waiting or failed, and whether a lesson is being rewritten.
import assert from 'node:assert/strict';
import { courseGenerationState, isTopicRewriting } from '../src/lib/courseGeneration.js';

const plan = [
    { title: 'Osmosis', status: 'written', topicId: 't1', start: 0, end: 10 },
    { title: 'Diffusion', status: 'pending', topicId: null, start: 10, end: 20 },
    { title: 'Active transport', status: 'failed', topicId: null, start: 20, end: 30 },
    { title: 'Endocytosis', status: 'pending', topicId: null, start: 30, end: 40 },
];
const idle = { generation: { active: false, kind: null, planIndexes: [] } };

// A course job is writing every pending part; failed ones stay failed.
{
    const state = courseGenerationState({ status: 'generating', lessonPlan: plan, generation: { active: true, kind: 'course', planIndexes: [] } });
    assert.equal(state.writing, true);
    assert.equal(state.written, 1);
    assert.equal(state.total, 4);
    assert.deepEqual(state.parts.map((part) => [part.number, part.state]), [[2, 'writing'], [3, 'failed'], [4, 'writing']]);
}

// A lessons job writes only what it lists; the other parts wait.
{
    const state = courseGenerationState({ status: 'ready', lessonPlan: plan, generation: { active: true, kind: 'lessons', planIndexes: [2] } });
    assert.deepEqual(state.parts.map((part) => [part.number, part.state]), [[2, 'waiting'], [3, 'writing'], [4, 'waiting']]);
}

// Nothing running.
{
    const state = courseGenerationState({ status: 'ready', lessonPlan: plan, ...idle });
    assert.equal(state.writing, false);
    assert.equal(state.failedCourse, false);
    assert.deepEqual(state.parts.map((part) => part.state), ['waiting', 'failed', 'waiting']);
    assert.equal(courseGenerationState({ status: 'failed', lessonPlan: [], ...idle }).failedCourse, true);
    assert.deepEqual(courseGenerationState(null).parts, []);
}

// A lesson is being rewritten only while a lessons job lists its plan entry.
{
    const rewriting = { lessonPlan: plan, generation: { active: true, kind: 'lessons', planIndexes: [0] } };
    assert.equal(isTopicRewriting('t1', rewriting), true);
    assert.equal(isTopicRewriting('t1', { lessonPlan: plan, generation: { active: true, kind: 'lessons', planIndexes: [1] } }), false);
    assert.equal(isTopicRewriting('t1', { lessonPlan: plan, generation: { active: true, kind: 'course', planIndexes: [] } }), false);
    assert.equal(isTopicRewriting('t1', { lessonPlan: plan, ...idle }), false);
    assert.equal(isTopicRewriting('', rewriting), false);
}

console.log('course-generation-client-regression.test.mjs passed');
