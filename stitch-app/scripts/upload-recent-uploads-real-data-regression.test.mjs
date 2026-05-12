import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const source = await fs.readFile(
  path.join(process.cwd(), 'src/pages/UploadMaterials.jsx'),
  'utf8',
);

const requireIncludes = (snippet) => {
  if (!source.includes(snippet)) {
    throw new Error(`UploadMaterials.jsx should include "${snippet}".`);
  }
};

const requireExcludes = (snippet) => {
  if (source.includes(snippet)) {
    throw new Error(`UploadMaterials.jsx should not include mock upload text "${snippet}".`);
  }
};

requireIncludes('useQuery(api.uploads.getUserUploads, {})');
requireIncludes('const recentUploads = useMemo(() => (uploads || []).slice(0, 3), [uploads]);');
requireIncludes("{upload.fileName || 'Untitled material'}");
requireIncludes('Uploaded {formatRelativeTime(upload._creationTime)} &bull; {formatFileSize(upload.fileSize)}');

[
  'Biology 101 - Cell Structure.pdf',
  'Marketing Strategy Q3 Deck.pptx',
  'Lecture Notes - History 204.docx',
  '2.4 MB',
  '5.1 MB',
  '1.1 MB',
].forEach(requireExcludes);

console.log('upload-recent-uploads-real-data-regression.test.mjs passed');
