import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const sentryLib = await fs.readFile(path.join(root, 'src', 'lib', 'sentry.js'), 'utf8');
if (!/VITE_SENTRY_DSN/.test(sentryLib)) {
  throw new Error('Expected sentry.js to read VITE_SENTRY_DSN.');
}
if (!/VITE_SENTRY_TUNNEL/.test(sentryLib)) {
  throw new Error('Expected sentry.js to read VITE_SENTRY_TUNNEL.');
}
if (!/Sentry\.init\(/.test(sentryLib)) {
  throw new Error('Expected sentry.js to initialize Sentry.');
}
if (!/tunnel:\s*sentryTunnel\s*\|\|\s*undefined/.test(sentryLib)) {
  throw new Error('Expected sentry.js to configure a Sentry tunnel endpoint.');
}
if (!/keepalive:\s*true/.test(sentryLib)) {
  throw new Error('Expected sentry.js to use keepalive transport fetch options.');
}
if (!/KNOWN_NOISE_ERROR_PATTERNS/.test(sentryLib)) {
  throw new Error('Expected sentry.js to define known noisy external error patterns.');
}
if (!/SCDynimacBridge/.test(sentryLib)) {
  throw new Error('Expected sentry.js to filter SCDynimacBridge noise errors.');
}
if (!/beforeSend\s*\(/.test(sentryLib)) {
  throw new Error('Expected sentry.js to include a beforeSend filter.');
}
if (!/ignoreErrors:\s*KNOWN_NOISE_ERROR_PATTERNS/.test(sentryLib)) {
  throw new Error('Expected sentry.js to pass known noise patterns via ignoreErrors.');
}

const sentryTunnelSource = await fs.readFile(path.join(root, 'api', 'sentry-tunnel.js'), 'utf8');
if (!/parseEnvelopeDsn/.test(sentryTunnelSource)) {
  throw new Error('Expected sentry tunnel API to parse DSN from envelope.');
}
if (!/Invalid DSN host/.test(sentryTunnelSource)) {
  throw new Error('Expected sentry tunnel API to reject invalid DSN hosts.');
}

const mainSource = await fs.readFile(path.join(root, 'src', 'main.jsx'), 'utf8');
if (!/initSentry\(\)/.test(mainSource)) {
  throw new Error('Expected main.jsx to call initSentry().');
}
if (!/Sentry\.ErrorBoundary/.test(mainSource) && !/AppErrorBoundary/.test(mainSource)) {
  throw new Error('Expected main.jsx to wrap the app in an error boundary.');
}

const authSource = await fs.readFile(path.join(root, 'src', 'contexts', 'AuthContext.jsx'), 'utf8');
if (!/setSentryUser\(/.test(authSource)) {
  throw new Error('Expected AuthContext to set Sentry user context.');
}
if (!/captureSentryException\(/.test(authSource)) {
  throw new Error('Expected AuthContext to capture auth/profile exceptions in Sentry.');
}
if (!/captureAuthFailure\s*=\s*\(/.test(authSource)) {
  throw new Error('Expected AuthContext to define captureAuthFailure diagnostics helper.');
}
for (const pattern of [
  'authBaseUrl',
  'connectionEffectiveType',
  'connectionDownlink',
  'connectionRtt',
  'connectionSaveData',
  "operation: 'sign_in_google'",
  "operation: 'sign_in'",
  "operation: 'sign_up'",
  "operation: 'ott_verify'",
]) {
  if (!authSource.includes(pattern)) {
    throw new Error(`Expected AuthContext to include auth diagnostics pattern "${pattern}".`);
  }
}

const examModeSource = await fs.readFile(path.join(root, 'src', 'pages', 'ExamMode.jsx'), 'utf8');
if (!/EXAM_LOADING_STALL_TIMEOUT_MS/.test(examModeSource)) {
  throw new Error('Expected ExamMode to define a loading stall timeout.');
}
if (!/Exam flow stalled in loading state/.test(examModeSource)) {
  throw new Error('Expected ExamMode to report stalled exam loading to Sentry.');
}

const convexAiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');
if (!/captureBackendSentryMessage/.test(convexAiSource)) {
  throw new Error('Expected convex/ai.ts to define backend Sentry message capture helper.');
}
if (!/Question bank generation hit time budget/.test(convexAiSource)) {
  throw new Error('Expected question-bank time budget warnings to be sent to backend Sentry.');
}
if (!/Question bank generation hit no-progress limit/.test(convexAiSource)) {
  throw new Error('Expected no-progress question-bank exits to be sent to backend Sentry.');
}
if (!/Question bank generation finished/.test(convexAiSource)) {
  throw new Error('Expected question-bank completion summaries to be sent to backend Sentry.');
}

console.log('sentry-instrumentation-regression.test.mjs passed');
