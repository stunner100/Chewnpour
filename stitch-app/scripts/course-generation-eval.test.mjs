import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAiCoursePayload } from '../server/aiCourseGeneration.js';
import { scoreCourseCurriculum } from '../server/courseEval.js';
import { snippetHasProcess } from '../server/processOrdering.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'scripts', 'fixtures', 'course-eval');
const sourceText = await fs.readFile(path.join(fixtureDir, 'krebs-cycle.md'), 'utf8');
const payload = JSON.parse(await fs.readFile(path.join(fixtureDir, 'krebs-cycle.payload.json'), 'utf8'));

assert.equal(snippetHasProcess(sourceText), true, 'process fixture must contain sequence language');

const normalized = normalizeAiCoursePayload(payload, {
  fileName: 'krebs.pdf',
  extractedText: sourceText,
});
const score = scoreCourseCurriculum(normalized, {
  sourceText,
  expectProcess: true,
});

assert.equal(score.structureOk, true, 'curriculum must have titled topics with content and questions');
assert.equal(score.duplicatePairs, 0, 'near-duplicate MCQs must be removed before scoring');
assert.ok(score.groundedRatio >= 0.5, 'answers must be grounded in the topic snippet');
assert.ok(score.orderingCount >= 1, 'has_process fixture must keep a process-ordering check');
assert.equal(score.processOk, true);
assert.ok(score.inLessonCount >= 2, 'multi-section fixture must emit in-lesson checks');
assert.equal(score.inLessonCoverageOk, true, 'each multi-section topic must have in-lesson coverage');

const orderingSource = await fs.readFile(path.join(root, 'src', 'components', 'lesson', 'LessonOrderingCheck.jsx'), 'utf8');
assert.match(orderingSource, /draggable/, 'ordering UI must use drag-and-drop');
assert.match(orderingSource, /Check order/, 'ordering UI must submit before revealing the canonical order');
assert.doesNotMatch(
  orderingSource.slice(0, orderingSource.indexOf('submitted')),
  /canonical\.map/,
  'canonical order should not render before submit',
);

const coursesSource = await fs.readFile(path.join(root, 'server', 'courses.js'), 'utf8');
assert.match(coursesSource, /= 'in_lesson'/, 'topic GET must load in-lesson checks');
assert.match(coursesSource, /MCQ_TYPE_SQL/, 'quizzes must exclude ordering rows');

const examsSource = await fs.readFile(path.join(root, 'server', 'exams.js'), 'utf8');
assert.match(examsSource, /question_type, 'multiple_choice'/, 'exams must stay MCQ-only');
assert.match(examsSource, /surface, 'quiz'/, 'exams must require surface=quiz');

const stepper = await fs.readFile(path.join(root, 'src', 'components', 'lesson', 'LessonSectionStepper.jsx'), 'utf8');
assert.match(stepper, /LessonInlineCheck/, 'lesson stepper must mount in-lesson checks');

console.log('course-generation-eval.test.mjs passed', score);
