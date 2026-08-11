import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const migration = await fs.readFile(
  path.join(root, 'supabase', 'migrations', '20260724122000_uploads_storage.sql'),
  'utf8',
);
if (!/CREATE TABLE IF NOT EXISTS "uploads"/.test(migration)) {
  throw new Error('Expected uploads migration to create the uploads table.');
}
if (!/study-uploads/.test(migration)) {
  throw new Error('Expected uploads migration to provision the study-uploads bucket.');
}

const uploadsSource = await fs.readFile(path.join(root, 'server', 'uploads.js'), 'utf8');
for (const symbol of ['initUploadForUser', 'finalizeUploadForUser', 'listUploadsForUser', 'deleteUploadForUser']) {
  if (!uploadsSource.includes(`export const ${symbol}`)) {
    throw new Error(`Expected server/uploads.js to export ${symbol}.`);
  }
}

const uploadHttp = await fs.readFile(path.join(root, 'server', 'uploadHttp.js'), 'utf8');
if (!/handleUploadsRequest/.test(uploadHttp) || !/auth\.api\.getSession/.test(uploadHttp)) {
  throw new Error('Expected upload HTTP handler to require a Better Auth session.');
}
if (!/method === "DELETE"/.test(uploadHttp)) {
  throw new Error('Expected upload HTTP handler to support DELETE.');
}

const apiRoute = await fs.readFile(path.join(root, 'api', 'router.js'), 'utf8');
if (!/handleUploadsRequest/.test(apiRoute) || !/\/api\/uploads/.test(apiRoute)) {
  throw new Error('Expected api/router.js to route /api/uploads to the uploads HTTP handler.');
}
if (!/maxDuration:\s*300/.test(apiRoute)) {
  throw new Error('Expected api/router.js to allow longer OCR finalize duration.');
}

const anydocClient = await fs.readFile(path.join(root, 'server', 'anydocClient.js'), 'utf8');
if (!/callAnydocExtract/.test(anydocClient) || !/isAnydocExtractable/.test(anydocClient)) {
  throw new Error('Expected server/anydocClient.js to expose anydoc extract helpers.');
}
if (!uploadsSource.includes('callAnydocExtract') || !uploadsSource.includes('isAnydocExtractable')) {
  throw new Error('Expected finalizeUploadForUser to use anydoc extraction.');
}
if (!uploadsSource.includes('callOcrSpace')) {
  throw new Error('Expected finalizeUploadForUser to fall back to OCR.space.');
}
if (/doclingClient|callDoclingExtract|isDoclingEnabled/.test(uploadsSource)) {
  throw new Error('Expected finalizeUploadForUser to stop depending on Docling.');
}
if (uploadsSource.includes('extraction_status: "deferred"')) {
  throw new Error('Expected deferred ready+charge path to be removed.');
}

const localExtract = await fs.readFile(path.join(root, 'server', 'localExtract.js'), 'utf8');
if (!/callLocalExtract/.test(localExtract) || !/isLocalExtractable/.test(localExtract)) {
  throw new Error('Expected server/localExtract.js to expose local PDF/DOCX extract helpers.');
}
if (!uploadsSource.includes('callLocalExtract') || !uploadsSource.includes('isLocalExtractable')) {
  throw new Error('Expected finalizeUploadForUser to fall back to local extraction.');
}
if (uploadsSource.includes('extraction_status: "not_configured"')) {
  throw new Error('Bootstrap not_configured path should be retired in favor of local extract.');
}

const page = await fs.readFile(path.join(root, 'src', 'pages', 'UploadMaterials.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(page)) {
  throw new Error('Expected UploadMaterials to stop depending on Convex.');
}
if (!/\/api\/uploads\/init/.test(page) || !/finalize/.test(page)) {
  throw new Error('Expected UploadMaterials to use the Supabase upload API.');
}

const viteConfig = await fs.readFile(path.join(root, 'vite.config.js'), 'utf8');
if (!/['"]\/api\/uploads['"]/.test(viteConfig)) {
  throw new Error('Expected Vite to proxy /api/uploads to the local API server.');
}

const envExample = await fs.readFile(path.join(root, '.env.example'), 'utf8');
if (!/SUPABASE_SERVICE_ROLE_KEY=/.test(envExample) || !/SUPABASE_STORAGE_BUCKET=/.test(envExample)) {
  throw new Error('Expected .env.example to document Supabase Storage credentials.');
}

console.log('supabase-uploads-milestone-regression.test.mjs passed');
