import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const schemaPath = resolve(root, 'convex', 'schema.ts');
const tutorPath = resolve(root, 'convex', 'tutor.ts');
const tutorSupportPath = resolve(root, 'convex', 'lib', 'tutorSupport.ts');
const aiPath = resolve(root, 'convex', 'ai.ts');
const chatPanelPath = resolve(root, 'src', 'components', 'TopicChatPanel.jsx');
const guidedPathPath = resolve(root, 'src', 'components', 'GuidedStudyPath.jsx');
const topicDetailPath = resolve(root, 'src', 'pages', 'TopicDetail.jsx');

const schemaSource = readFileSync(schemaPath, 'utf8');
const tutorSource = readFileSync(tutorPath, 'utf8');
const tutorSupportSource = readFileSync(tutorSupportPath, 'utf8');
const aiSource = readFileSync(aiPath, 'utf8');
const chatPanelSource = readFileSync(chatPanelPath, 'utf8');
const guidedPathSource = readFileSync(guidedPathPath, 'utf8');
const topicDetailSource = readFileSync(topicDetailPath, 'utf8');

assert.ok(
  schemaSource.includes('userTutorProfiles: defineTable')
    && schemaSource.includes('userTutorMemory: defineTable'),
  'Expected schema to store persistent tutor persona and topic memory records.'
);
assert.ok(
  tutorSource.includes('export const getTutorProfile')
    && tutorSource.includes('export const setTutorPersona')
    && tutorSource.includes('export const getTopicTutorSupport')
    && tutorSource.includes('export const upsertTopicTutorMemoryInternal'),
  'Expected tutor.ts to expose tutor profile, support, and memory upsert APIs.'
);
assert.ok(
  tutorSupportSource.includes('export const TUTOR_PERSONAS')
    && tutorSupportSource.includes('buildTutorMemorySnapshot')
    && tutorSupportSource.includes('normalizeTutorPersona'),
  'Expected tutor support helpers to define personas and learner-memory snapshot generation.'
);
assert.ok(
  aiSource.includes('persona: v.optional(v.string())')
    && aiSource.includes('const tutorMemorySnapshot = buildTutorMemorySnapshot(')
    && aiSource.includes('getTutorPersonaPrompt(persona)')
    && aiSource.includes('internal.tutor.upsertTopicTutorMemoryInternal'),
  'Expected askTopicTutor to be persona-aware and to persist learner memory after replies.'
);
assert.ok(
  chatPanelSource.includes('api.tutor.getTopicTutorSupport')
    && chatPanelSource.includes('api.tutor.setTutorPersona')
    && chatPanelSource.includes('await askTutor({ topicId, question, persona: selectedPersona })')
    && chatPanelSource.includes('Tutor style'),
  'Expected TopicChatPanel to fetch tutor support, let the user switch personas, and pass persona into tutor requests.'
);
assert.ok(
  guidedPathSource.includes('Guided Study Path')
    && guidedPathSource.includes('Ask tutor here')
    && guidedPathSource.includes('Jump to section'),
  'Expected GuidedStudyPath to render a guided lesson flow with tutor entry points.'
);
assert.ok(
  topicDetailSource.includes("import GuidedStudyPath from '../components/GuidedStudyPath';")
    && topicDetailSource.includes('<GuidedStudyPath'),
  'Expected TopicDetail to surface the guided study path in the lesson view.'
);

console.log('tutor-memory-guided-learning-regression tests passed');
