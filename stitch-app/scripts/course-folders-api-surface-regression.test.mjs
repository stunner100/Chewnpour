import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const courseFoldersModulePath = path.join(root, 'convex', 'courseFolders.ts');
const courseFoldersModuleSource = await fs.readFile(courseFoldersModulePath, 'utf8');

for (const exportName of ['listFolders', 'createFolder', 'renameFolder', 'deleteFolder', 'moveCourseToFolder']) {
  const exportPattern = new RegExp(`export const ${exportName} =`);
  if (!exportPattern.test(courseFoldersModuleSource)) {
    throw new Error(`Expected convex/courseFolders.ts to export ${exportName}.`);
  }
}

const schemaPath = path.join(root, 'convex', 'schema.ts');
const schemaSource = await fs.readFile(schemaPath, 'utf8');

if (!/courseFolders:\s*defineTable\(\{[\s\S]*color:\s*v\.optional\(v\.string\(\)\)/m.test(schemaSource)) {
  throw new Error('Expected courseFolders table schema to support an optional color field.');
}

if (!/courses:\s*defineTable\([\s\S]*\.index\("by_userId_folderId",\s*\["userId",\s*"folderId"\]\)/m.test(schemaSource)) {
  throw new Error('Expected courses schema to define the by_userId_folderId index.');
}

console.log('course-folders-api-surface-regression.test.mjs passed');
