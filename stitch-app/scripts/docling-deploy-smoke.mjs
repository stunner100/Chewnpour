import fs from 'node:fs/promises';
import path from 'node:path';

const usage = `Usage:
  node scripts/docling-deploy-smoke.mjs --url <docling-base-url> --file <absolute-file-path> [--token <bearer-token>]

Env fallback:
  DOCLING_API_BASE_URL
  DOCLING_API_KEY
`;

const parseArgs = (argv) => {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') parsed.url = argv[++i];
    else if (arg === '--file') parsed.file = argv[++i];
    else if (arg === '--token') parsed.token = argv[++i];
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
};

const sanitize = (value) => String(value || '').trim();

const getDocument = (payload) => {
  if (payload?.document && typeof payload.document === 'object') return payload.document;
  if (Array.isArray(payload?.documents) && payload.documents[0]) return payload.documents[0];
  if (Array.isArray(payload?.results) && payload.results[0]?.document) return payload.results[0].document;
  return null;
};

const inferMime = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }

  const baseUrl = sanitize(args.url || process.env.DOCLING_API_BASE_URL).replace(/\/+$/, '');
  const filePath = sanitize(args.file);
  const token = sanitize(args.token || process.env.DOCLING_API_KEY);

  if (!baseUrl || !filePath) {
    throw new Error(`Missing required inputs.\n\n${usage}`);
  }

  const fileBuffer = await fs.readFile(filePath);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}/v1/convert/source`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      options: {
        to_formats: ['md'],
        do_ocr: true,
        do_table_structure: true,
        md_page_break_placeholder: '\f',
      },
      sources: [{
        kind: 'file',
        filename: path.basename(filePath),
        content_type: inferMime(filePath),
        base64_string: fileBuffer.toString('base64'),
      }],
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Docling smoke failed: HTTP ${response.status}\n${bodyText}`);
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`Docling smoke failed: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }

  const document = getDocument(payload);
  const markdown = sanitize(document?.md_content || document?.markdown || payload?.md_content);
  if (!markdown) {
    throw new Error(`Docling smoke failed: empty markdown response\n${JSON.stringify(payload, null, 2).slice(0, 2000)}`);
  }

  console.log('docling-deploy-smoke.mjs passed');
  console.log(JSON.stringify({
    status: payload?.status || 'ok',
    file: path.basename(filePath),
    extractedChars: markdown.length,
    preview: markdown.slice(0, 200),
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
