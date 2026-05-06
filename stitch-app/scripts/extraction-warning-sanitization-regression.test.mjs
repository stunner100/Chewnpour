import fs from "node:fs";

const doclingClientSource = fs.readFileSync(
  new URL("../convex/lib/doclingClient.ts", import.meta.url),
  "utf8",
);
const processingPageSource = fs.readFileSync(
  new URL("../src/pages/DashboardProcessing.jsx", import.meta.url),
  "utf8",
);

if (!/summarizeDoclingHttpError/.test(doclingClientSource)) {
  throw new Error("Expected Docling HTTP errors to be summarized before throwing.");
}

if (!/gateway timeout/.test(doclingClientSource)) {
  throw new Error("Expected Docling 504 responses to become gateway timeout summaries.");
}

if (/Docling extract error:\s*\$\{response\.status\}\s*-\s*\$\{errorBody\}/.test(doclingClientSource)) {
  throw new Error("Docling client must not include raw HTML response bodies in thrown errors.");
}

if (!/formatExtractionWarning/.test(processingPageSource)) {
  throw new Error("Expected processing UI to format stored extraction warnings.");
}

if (!/docling_primary_failed/i.test(processingPageSource)) {
  throw new Error("Expected processing UI to sanitize old persisted Docling warning prefixes.");
}

if (!/Docling took too long, so we continued with another extractor/.test(processingPageSource)) {
  throw new Error("Expected old Docling 504 warnings to render as readable fallback copy.");
}

console.log("extraction-warning-sanitization-regression.test.mjs passed");
