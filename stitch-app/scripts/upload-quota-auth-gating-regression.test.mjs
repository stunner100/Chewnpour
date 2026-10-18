import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const upload = await fs.readFile(path.join(root, 'src', 'pages', 'UploadMaterials.jsx'), 'utf8');
if (/api\.subscriptions\.getUploadQuotaStatus/.test(upload) || /useConvexAuth/.test(upload)) {
  throw new Error('Live upload page must not gate on Convex upload quota.');
}


console.log('upload-quota-auth-gating-regression.test.mjs passed');
