import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const upload = await fs.readFile(path.join(root, 'src', 'pages', 'UploadMaterials.jsx'), 'utf8');
const app = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');

if (/paywallMessage/.test(upload) || /UPLOAD_CREDITS_EXHAUSTED/.test(upload)) {
  throw new Error('UploadMaterials must not send users to a paywall.');
}

if (!app.includes('<Route path="/subscription" element={<Navigate to="/dashboard" replace />} />')) {
  throw new Error('Expected /subscription to redirect to the dashboard.');
}


console.log('upload-quota-messaging-regression.test.mjs passed');
