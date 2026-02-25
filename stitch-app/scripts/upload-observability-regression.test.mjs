import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const uploadObservability = await read('src/lib/uploadObservability.js');
for (const symbol of [
  'createUploadObservation',
  'reportUploadValidationRejected',
  'reportUploadFlowStarted',
  'reportUploadStage',
  'reportUploadFlowCompleted',
  'reportUploadFlowFailed',
]) {
  if (!new RegExp(`export const ${symbol}\\s*=`, 'm').test(uploadObservability)) {
    throw new Error(`Expected uploadObservability helper to export ${symbol}.`);
  }
}
if (!uploadObservability.includes('Large upload detected')) {
  throw new Error('Expected uploadObservability to report large upload warning signals.');
}
if (!uploadObservability.includes('Upload flow slow')) {
  throw new Error('Expected uploadObservability to report slow upload warning signals.');
}
for (const pattern of [
  'isTransientUploadTransportError',
  'transientTransport',
  "level: transientTransport ? 'warning' : 'error'",
]) {
  if (!uploadObservability.includes(pattern)) {
    throw new Error(`Expected uploadObservability to include "${pattern}" for transient transport resilience.`);
  }
}

const dashboardAnalysis = await read('src/pages/DashboardAnalysis.jsx');
for (const pattern of [
  'createUploadObservation',
  'reportUploadValidationRejected',
  'reportUploadFlowStarted',
  'reportUploadFlowCompleted',
  'reportUploadFlowFailed',
]) {
  if (!dashboardAnalysis.includes(pattern)) {
    throw new Error(`Expected DashboardAnalysis upload flow to use ${pattern}.`);
  }
}
if (!dashboardAnalysis.includes('uploadInFlightRef')) {
  throw new Error('Expected DashboardAnalysis to guard against concurrent uploads.');
}
if (!dashboardAnalysis.includes("reason: 'upload_in_progress'")) {
  throw new Error('Expected DashboardAnalysis to log upload_in_progress rejections.');
}
if (!dashboardAnalysis.includes('An upload is already in progress. Please wait for it to finish.')) {
  throw new Error('Expected DashboardAnalysis to show a helpful concurrent upload message.');
}
const dashboardUploadingDisabledMatches = dashboardAnalysis.match(/disabled=\{uploading\}/g) || [];
if (dashboardUploadingDisabledMatches.length < 4) {
  throw new Error('Expected all DashboardAnalysis upload entry points to be disabled while uploading.');
}

const assignmentHelper = await read('src/pages/AssignmentHelper.jsx');
for (const pattern of [
  'createUploadObservation',
  'reportUploadValidationRejected',
  'reportUploadFlowStarted',
  'reportUploadFlowCompleted',
  'reportUploadFlowFailed',
]) {
  if (!assignmentHelper.includes(pattern)) {
    throw new Error(`Expected AssignmentHelper upload flow to use ${pattern}.`);
  }
}

const dashboardProcessing = await read('src/pages/DashboardProcessing.jsx');
if (!dashboardProcessing.includes("operation: 'processing_failed'")) {
  throw new Error('Expected DashboardProcessing to report upload processing_failed events.');
}
if (!dashboardProcessing.includes("operation: 'processing_ready'")) {
  throw new Error('Expected DashboardProcessing to report upload processing_ready events.');
}
if (!dashboardProcessing.includes('Upload processing step updated')) {
  throw new Error('Expected DashboardProcessing to add upload processing step breadcrumbs.');
}

console.log('upload-observability-regression.test.mjs passed');
