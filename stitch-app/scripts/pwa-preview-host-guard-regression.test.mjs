import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const [mainSource, viteConfigSource] = await Promise.all([
  fs.readFile(path.join(root, "src/main.jsx"), "utf8"),
  fs.readFile(path.join(root, "vite.config.js"), "utf8"),
]);

const expectations = [
  "const clearLegacyPwaRuntime = () => {",
  "if (!import.meta.env.PROD",
  "navigator.serviceWorker.getRegistrations()",
  "registration.unregister()",
  "window.caches.keys()",
  "removeManifestLink()",
  "const applyPwaCutover = () => {",
  "applyPwaCutover();",
];

for (const snippet of expectations) {
  if (!mainSource.includes(snippet)) {
    throw new Error(`main.jsx is missing expected PWA shutdown guard snippet: ${snippet}`);
  }
}

if (mainSource.includes("registerSW(") || mainSource.includes("from 'virtual:pwa-register'")) {
  throw new Error("main.jsx must not register a runtime PWA service worker.");
}

if (viteConfigSource.includes("VitePWA(") || viteConfigSource.includes("from 'vite-plugin-pwa'")) {
  throw new Error("vite.config.js must not enable vite-plugin-pwa.");
}

console.log("pwa-preview-host-guard-regression.test.mjs passed");
