import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  fs.readFile(path.join(root, relativePath), 'utf8');

const resilienceSource = await read('src/lib/uploadNetworkResilience.js');
for (const pattern of [
  'export const isTransientUploadTransportError = (error) =>',
  'export const uploadToStorageWithRetry = async ({',
  'RETRYABLE_STATUS_CODES',
  'maxAttempts = 3',
  'await sleep(delayMs);',
]) {
  if (!resilienceSource.includes(pattern)) {
    throw new Error(`Expected uploadNetworkResilience to include "${pattern}".`);
  }
}

const dashboardSource = await read('src/pages/DashboardAnalysis.jsx');
for (const pattern of [
  'uploadToStorageWithRetry({',
  'maxAttempts: 3',
  'request_upload_url_retry',
  'upload_to_storage_retry',
  'fresh upload URL and retrying once',
  'isTransientUploadTransportError(error)',
  'temporary network issue',
]) {
  if (!dashboardSource.includes(pattern)) {
    throw new Error(`Expected DashboardAnalysis to include "${pattern}" for upload retry resilience.`);
  }
}

const assignmentSource = await read('src/pages/AssignmentHelper.jsx');
for (const pattern of [
  'uploadToStorageWithRetry({',
  'maxAttempts: 3',
  'request_upload_url_retry',
  'upload_to_storage_retry',
  'fresh upload URL and retrying once',
  'isTransientUploadTransportError(uploadError)',
  'temporary network issue',
]) {
  if (!assignmentSource.includes(pattern)) {
    throw new Error(`Expected AssignmentHelper to include "${pattern}" for upload retry resilience.`);
  }
}

console.log('upload-storage-retry-resilience-regression.test.mjs passed');
