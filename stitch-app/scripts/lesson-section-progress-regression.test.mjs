import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonSectionPercent } from '../src/lib/lessonSectionProgress.js';

// Section progress counts finished sections, so opening a one-section lesson is 0%, not 100%.
assert.equal(lessonSectionPercent({ sectionIndex: 0, sectionCount: 1 }), 0);
assert.equal(lessonSectionPercent({ sectionIndex: 0, sectionCount: 1, completed: true }), 100);
assert.equal(lessonSectionPercent({ sectionIndex: 0, sectionCount: 4 }), 0);
assert.equal(lessonSectionPercent({ sectionIndex: 2, sectionCount: 4 }), 50);
assert.equal(lessonSectionPercent({ sectionIndex: 3, sectionCount: 4 }), 75);
assert.equal(lessonSectionPercent({ sectionIndex: 9, sectionCount: 4 }), 100);
assert.equal(lessonSectionPercent({ sectionIndex: 0, sectionCount: 0, completed: true }), 0);
assert.equal(lessonSectionPercent(), 0);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const views = readFileSync(join(root, 'src/components/topic/TopicLessonViews.jsx'), 'utf8');
assert.match(views, /percent=\{lessonSectionPercent\(\{[\s\S]*?completed: Boolean\(topicProgress\?\.completedAt\)/);
assert.doesNotMatch(views, /\(currentStepIndex \+ 1\) \/ sectionCount/, 'entering a section must not count it as finished');

console.log('lesson-section-progress-regression.test.mjs passed');
