import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const posthogLib = await read('src/lib/posthog.js');
for (const pattern of [
  'VITE_POSTHOG_KEY',
  'client.init',
  'capturePostHogEvent',
  'capturePostHogPageView',
  'setPostHogUser',
  'resetPostHogUser',
  'disable_session_recording: false',
  'disable_surveys: false',
  'maskAllInputs: true',
  'maskTextSelector',
]) {
  if (!posthogLib.includes(pattern)) {
    throw new Error(`Expected src/lib/posthog.js to include "${pattern}".`);
  }
}

const mainSource = await read('src/main.jsx');
if (!mainSource.includes('initPostHog()')) {
  throw new Error('Expected src/main.jsx to initialize PostHog.');
}

const stepper = await read('src/components/lesson/LessonSectionStepper.jsx');
if (!stepper.includes('ph-mask')) {
  throw new Error('Lesson reading stage must mask session-replay text.');
}

const chatPanel = await read('src/components/TopicChatPanel.jsx');
if (!chatPanel.includes('ph-mask')) {
  throw new Error('Tutor chat must mask session-replay text.');
}

const authSource = await read('src/contexts/AuthContext.jsx');
for (const pattern of ['setPostHogUser(', 'resetPostHogUser(']) {
  if (!authSource.includes(pattern)) {
    throw new Error(`Expected AuthContext to call ${pattern}`);
  }
}

const uploadObservability = await read('src/lib/uploadObservability.js');
for (const pattern of [
  'capturePostHogEvent',
  'upload_validation_rejected',
  'upload_flow_started',
  'upload_flow_completed',
  'upload_flow_failed',
]) {
  if (!uploadObservability.includes(pattern)) {
    throw new Error(`Expected upload observability to capture PostHog event "${pattern}".`);
  }
}

console.log('posthog-instrumentation-regression.test.mjs passed');
