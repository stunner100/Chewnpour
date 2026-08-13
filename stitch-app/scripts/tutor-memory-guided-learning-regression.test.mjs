import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const chatPanelPath = resolve(root, 'src', 'components', 'TopicChatPanel.jsx');
const contentPanelPath = resolve(root, 'src', 'components', 'topic', 'TopicContentPanel.jsx');
const stepperPath = resolve(root, 'src', 'components', 'lesson', 'LessonSectionStepper.jsx');
const schemaPath = resolve(root, 'convex', 'schema.ts');

const chatPanelSource = readFileSync(chatPanelPath, 'utf8');
const contentPanelSource = readFileSync(contentPanelPath, 'utf8');
const stepperSource = readFileSync(stepperPath, 'utf8');

assert.ok(
  chatPanelSource.includes('askTopicTutor')
    && chatPanelSource.includes('persona: selectedPersona')
    && chatPanelSource.includes('Tutor style'),
  'Expected TopicChatPanel to let the user switch personas and pass persona into tutor requests.'
);
assert.ok(
  contentPanelSource.includes('LessonSectionStepper')
    && !contentPanelSource.includes('GuidedStudyPath'),
  'Expected the lesson page to use the section stepper instead of GuidedStudyPath.'
);
assert.ok(
  stepperSource.includes('LessonInlineCheck')
    && stepperSource.includes('Next section'),
  'Expected the section stepper to walk through lesson sections with a continue action.'
);

if (existsSync(schemaPath)) {
  const schemaSource = readFileSync(schemaPath, 'utf8');
  assert.ok(
    schemaSource.includes('userTutorProfiles: defineTable')
      && schemaSource.includes('userTutorMemory: defineTable'),
    'Expected schema to store persistent tutor persona and topic memory records.'
  );
}

console.log('tutor-memory-guided-learning-regression tests passed');
