import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath) => {
  const fullPath = resolve(root, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const appSource = read("src/App.jsx");

for (const route of [
  '<Route path="/kids" element={<Navigate to="/" replace />} />',
  '<Route path="/kids/parent" element={<Navigate to="/" replace />} />',
  '<Route path="/kids/upload" element={<Navigate to="/" replace />} />',
  '<Route path="/kids/child" element={<Navigate to="/" replace />} />',
  '<Route path="/kids/lesson/:lessonId" element={<Navigate to="/" replace />} />',
]) {
  assert.ok(appSource.includes(route), `App.jsx missing parked Kids redirect: ${route}`);
}

assert.equal(
  /KidsParentHome|KidsUpload|KidsChildHome|KidsLesson/.test(appSource),
  false,
  "App.jsx should not wire live Kids page components during Supabase cutover",
);

console.log("kids-mode-contract-regression.test.mjs passed");
