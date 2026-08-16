import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const helperPath = path.join(root, 'src', 'lib', 'chunkLoadRecovery.js');
const { isChunkLoadError, isMissingLazyRouteExportError } = await import(
  pathToFileURL(helperPath).href
);

const recoverableMessages = [
  'Error: Lazy route "Login" did not export a React component.',
  'Error: Lazy route "StudentDashboard" did not export a React component.',
  'Lazy route "UploadMaterials" did not export a React component.',
  'Failed to fetch dynamically imported module: https://www.chewnpour.com/assets/Login-abc.js',
];

for (const message of recoverableMessages) {
  if (!isChunkLoadError(message)) {
    throw new Error(`Expected chunk recovery to treat this as recoverable: ${message}`);
  }
}

for (const message of recoverableMessages.slice(0, 3)) {
  if (!isMissingLazyRouteExportError(message)) {
    throw new Error(`Expected missing lazy-route export detection for: ${message}`);
  }
}

for (const message of [
  'Invalid email or password',
  'Authentication request failed',
  'Network request failed',
]) {
  if (isChunkLoadError(message) || isMissingLazyRouteExportError(message)) {
    throw new Error(`Did not expect chunk recovery for: ${message}`);
  }
}

console.log('lazy-route-missing-export-recovery-regression.test.mjs passed');
