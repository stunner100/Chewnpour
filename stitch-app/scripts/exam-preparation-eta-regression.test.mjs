import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { getExamPreparationLoadingState } from '../src/lib/examPreparationEta.js';

const examModeSource = await fs.readFile(
  new URL('../src/pages/ExamMode.jsx', import.meta.url),
  'utf8',
);
const examPreparationEtaSource = await fs.readFile(
  new URL('../src/lib/examPreparationEta.js', import.meta.url),
  'utf8',
);

const initialObjectiveState = getExamPreparationLoadingState({
  examFormat: 'mcq',
  stage: 'queued',
  elapsedMs: 0,
});
assert.equal(initialObjectiveState.etaLabel, 'About 30s left', 'queued objective exams should expose an initial ETA');
assert.equal(initialObjectiveState.progressPercent, 8, 'queued objective exams should start at the progress floor');
assert.match(initialObjectiveState.helperLabel, /25-45 seconds/, 'objective exams should advertise the expected generation window');

const midObjectiveState = getExamPreparationLoadingState({
  examFormat: 'mcq',
  stage: 'generating_candidates',
  elapsedMs: 12000,
});
assert.equal(midObjectiveState.etaLabel, 'About 14s left', 'candidate generation should tighten the remaining ETA');
assert.ok(midObjectiveState.progressPercent >= 58, 'candidate generation should advance progress materially');

const lateEssayState = getExamPreparationLoadingState({
  examFormat: 'essay',
  stage: 'finalizing_attempt',
  elapsedMs: 22000,
});
assert.equal(lateEssayState.etaLabel, 'About 3s left', 'finalizing essay exams should show a short remaining ETA');
assert.match(lateEssayState.helperLabel, /20-35 seconds/, 'essay exams should use their own timing guidance');

const delayedState = getExamPreparationLoadingState({
  examFormat: 'mcq',
  stage: 'reviewing_quality',
  elapsedMs: 52000,
});
assert.equal(delayedState.etaLabel, 'Taking longer than usual, still preparing', 'long-running exam prep should acknowledge the delay');

for (const snippet of [
  "import { getExamPreparationLoadingState } from '../lib/examPreparationEta';",
  'const [preparationElapsedMs, setPreparationElapsedMs] = useState(0);',
  'const shouldShowPreparationLoadingState =',
  'const preparationLoadingState = useMemo(',
  'ETA',
  'complete</span>',
]) {
  assert.ok(
    examModeSource.includes(snippet),
    `Expected ExamMode.jsx to include exam ETA snippet: ${snippet}`,
  );
}

assert.ok(
  examPreparationEtaSource.includes('Objective exams are usually ready in 25-45 seconds.'),
  'Expected the exam preparation ETA helper to advertise the objective timing guidance.',
);

console.log('exam-preparation-eta-regression: ok');
