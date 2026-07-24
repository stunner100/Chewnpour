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
for (const symbol of ['initUploadForUser', 'finalizeUploadForUser', 'listUploadsForUser']) {
  if (!uploadsSource.includes(`export const ${symbol}`)) {
    throw new Error(`Expected server/uploads.js to export ${symbol}.`);
  }
}

const uploadHttp = await fs.readFile(path.join(root, 'server', 'uploadHttp.js'), 'utf8');
if (!/handleUploadsRequest/.test(uploadHttp) || !/auth\.api\.getSession/.test(uploadHttp)) {
  throw new Error('Expected upload HTTP handler to require a Better Auth session.');
}

const apiRoute = await fs.readFile(path.join(root, 'api', 'uploads', '[...all].js'), 'utf8');
if (!/handleUploadsRequest/.test(apiRoute)) {
  throw new Error('Expected api/uploads/[...all].js to export the uploads HTTP handler.');
}

const doclingClient = await fs.readFile(path.join(root, 'server', 'doclingClient.js'), 'utf8');
if (!/callDoclingExtract/.test(doclingClient) || !/isDoclingEnabled/.test(doclingClient)) {
  throw new Error('Expected server/doclingClient.js to expose Docling extract helpers.');
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
