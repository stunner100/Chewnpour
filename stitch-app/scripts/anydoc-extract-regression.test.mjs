import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { zipSync, strToU8 } from "fflate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const anydocClient = await import(
  pathToFileURL(path.join(rootDir, "server/anydocClient.js")).href
);
const uploadsSource = await fs.readFile(
  path.join(rootDir, "server/uploads.js"),
  "utf8",
);
const packageJson = JSON.parse(
  await fs.readFile(path.join(rootDir, "package.json"), "utf8"),
);

const {
  callAnydocExtract,
  isAnydocExtractable,
  isAnydocUnsupportedError,
  resolveAnydocFormat,
  AnydocExtractError,
} = anydocClient;

assert.ok(
  packageJson.dependencies?.["@firecrawl/anydoc"],
  "Expected @firecrawl/anydoc in package.json dependencies",
);

assert.equal(
  isAnydocExtractable({ fileName: "notes.pdf", contentType: "application/pdf" }),
  true,
);
assert.equal(
  isAnydocExtractable({
    fileName: "notes.docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  true,
);
assert.equal(
  isAnydocExtractable({
    fileName: "deck.pptx",
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  }),
  true,
);
assert.equal(
  isAnydocExtractable({ fileName: "scan.png", contentType: "image/png" }),
  false,
  "Images are out of scope for anydoc cutover",
);
assert.equal(
  isAnydocExtractable({ fileName: "lecture.mp3", contentType: "audio/mpeg" }),
  false,
);

assert.equal(resolveAnydocFormat({ fileName: "a.pdf" }), "pdf");
assert.equal(resolveAnydocFormat({ fileName: "a.docx" }), "docx");
assert.equal(resolveAnydocFormat({ fileName: "a.pptx" }), "pptx");

const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([400, 200]);
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
page.drawText("ChewnPour anydoc regression sample.", {
  x: 24,
  y: 120,
  size: 12,
  font,
});
const pdfBytes = await pdfDoc.save();
const pdfResult = await callAnydocExtract({
  fileName: "sample.pdf",
  contentType: "application/pdf",
  fileType: "pdf",
  fileBuffer: Buffer.from(pdfBytes),
});
assert.match(pdfResult.text, /ChewnPour anydoc regression sample/);
assert.equal(pdfResult.backend, "anydoc");
assert.equal(pdfResult.parser, "anydoc_pdf");

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Docx anydoc extract works.</w:t></w:r></w:p>
  </w:body>
</w:document>`;
const docxBytes = zipSync({
  "word/document.xml": strToU8(documentXml),
  "[Content_Types].xml": strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  ),
  "_rels/.rels": strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  ),
});
const docxResult = await callAnydocExtract({
  fileName: "sample.docx",
  contentType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  fileType: "docx",
  fileBuffer: Buffer.from(docxBytes),
});
assert.match(docxResult.text, /Docx anydoc extract works/);
assert.equal(docxResult.parser, "anydoc_docx");

assert.match(uploadsSource, /from "\.\/anydocClient\.js"/);
assert.match(uploadsSource, /callAnydocExtract/);
assert.match(uploadsSource, /isAnydocUnsupportedError/);
assert.match(uploadsSource, /Scanned or image-only document; OCR is not enabled/);
assert.match(uploadsSource, /extraction_status: "deferred"/);
assert.doesNotMatch(uploadsSource, /callDoclingExtract|doclingClient|isDoclingEnabled/);

const anydocClientSource = await fs.readFile(
  path.join(rootDir, "server/anydocClient.js"),
  "utf8",
);
assert.match(
  anydocClientSource,
  /import\("@firecrawl\/anydoc"\)/,
  "Anydoc must be lazy-loaded so API cold starts do not require the native binary",
);
assert.doesNotMatch(
  anydocClientSource,
  /^import \{[^}]*\} from "@firecrawl\/anydoc";/m,
  "Top-level anydoc import must not crash the shared API router",
);

const routerSource = await fs.readFile(path.join(rootDir, "api/router.js"), "utf8");
assert.match(
  routerSource,
  /@firecrawl\/anydoc-linux-x64-gnu/,
  "Router must include Linux anydoc NAPI binaries for Vercel",
);
const vercelConfig = JSON.parse(
  await fs.readFile(path.join(rootDir, "vercel.json"), "utf8"),
);
assert.match(
  String(vercelConfig.functions?.["api/router.js"]?.includeFiles || ""),
  /@firecrawl\/anydoc/,
);
const unsupported = new AnydocExtractError("image-only", { code: "unsupported" });
unsupported.isUnsupported = true;
assert.equal(isAnydocUnsupportedError(unsupported), true);
assert.equal(
  isAnydocUnsupportedError(new AnydocExtractError("encrypted", { code: "encrypted" })),
  false,
);

// Confirm Linux NAPI optional packages are declared for Vercel.
const lockPath = path.join(rootDir, "package-lock.json");
const lockText = await fs.readFile(lockPath, "utf8");
assert.match(
  lockText,
  /@firecrawl\/anydoc-linux-x64-gnu/,
  "Expected linux-x64-gnu optional binary in package-lock for Vercel",
);

console.log("anydoc-extract-regression.test.mjs passed");
