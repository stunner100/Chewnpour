import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const mainSource = await fs.readFile(path.join(root, "src/main.jsx"), "utf8");

const expectations = [
  "const PWA_ENABLED_HOSTS = new Set(['www.chewnpour.com', 'chewnpour.com']);",
  "const clearPreviewRuntimeCaches = async () => {",
  "if (!shouldEnablePwa()) {",
  "void clearPreviewRuntimeCaches();",
];

for (const snippet of expectations) {
  if (!mainSource.includes(snippet)) {
    throw new Error(`main.jsx is missing expected preview-PWA guard snippet: ${snippet}`);
  }
}

console.log("pwa-preview-host-guard-regression.test.mjs passed");
