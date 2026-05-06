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

if (/formatExtractionWarning/.test(processingPageSource)) {
  throw new Error("Processing UI must not render extraction warnings to learners.");
}

if (/extractionWarnings\.map/.test(processingPageSource)) {
  throw new Error("Processing UI must not map backend extraction warnings into visible copy.");
}

if (/Heads up/.test(processingPageSource)) {
  throw new Error("Processing UI must not show non-actionable fallback warning banners.");
}

console.log("extraction-warning-sanitization-regression.test.mjs passed");
