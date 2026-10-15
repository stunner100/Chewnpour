import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const chatPanelPath = resolve(root, 'src', 'components', 'TopicChatPanel.jsx');
const contentPanelPath = resolve(root, 'src', 'components', 'topic', 'TopicContentPanel.jsx');
const stepperPath = resolve(root, 'src', 'components', 'lesson', 'LessonSectionStepper.jsx');

const chatPanelSource = readFileSync(chatPanelPath, 'utf8');
const contentPanelSource = readFileSync(contentPanelPath, 'utf8');
const stepperSource = readFileSync(stepperPath, 'utf8');

assert.ok(
  chatPanelSource.includes('TUTOR_PERSONAS.map((persona)')
    && chatPanelSource.includes('handlePersonaChange(persona.key)')
    && chatPanelSource.includes('persona={selectedPersona}'),
  'Expected TopicChatPanel to let the user switch personas and pass persona into tutor requests.'
);
assert.ok(
  contentPanelSource.includes('LessonSectionStepper')
    && !contentPanelSource.includes('GuidedStudyPath'),
  'Expected the lesson page to use the section stepper instead of GuidedStudyPath.'
);
assert.ok(
  stepperSource.includes('LessonInlineCheck')
    && stepperSource.includes("'Finish lesson' : 'Continue'"),
  'Expected the section stepper to walk through lesson sections with a continue action.'
);

assert.ok(
  /await updateProfile\(\{\s*studyPreferences: \{[\s\S]*?preferredPersona: normalized,/.test(chatPanelSource),
  'Expected the chosen tutor persona to persist through the profile API.'
);

console.log('tutor-memory-guided-learning-regression tests passed');
