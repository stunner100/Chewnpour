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
  'posthog.init',
  'capturePostHogEvent',
  'capturePostHogPageView',
  'setPostHogUser',
  'resetPostHogUser',
]) {
  if (!posthogLib.includes(pattern)) {
    throw new Error(`Expected src/lib/posthog.js to include "${pattern}".`);
  }
}

const mainSource = await read('src/main.jsx');
if (!mainSource.includes('initPostHog()')) {
  throw new Error('Expected src/main.jsx to initialize PostHog.');
}
if (!mainSource.includes("from '@posthog/react'")) {
  throw new Error('Expected src/main.jsx to use PostHogProvider from @posthog/react.');
}

const appSource = await read('src/App.jsx');
for (const pattern of ['usePostHog', "posthog.capture('$pageview'"]) {
  if (!appSource.includes(pattern)) {
    throw new Error(`Expected src/App.jsx to include "${pattern}" for pageview tracking.`);
  }
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
