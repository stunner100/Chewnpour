import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath) => {
  const fullPath = resolve(root, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const appSource = read("src/App.jsx");

const parkedKidsView = 'element={<ParkedFeatureView title="Kids mode" primaryHref="/" primaryLabel="Back to home" />} />';
for (const path of ["/kids", "/kids/parent", "/kids/upload", "/kids/child", "/kids/lesson/:lessonId"]) {
  const route = `<Route path="${path}" ${parkedKidsView}`;
  assert.ok(appSource.includes(route), `App.jsx missing parked Kids route: ${route}`);
}
assert.ok(
  appSource.includes('<Route path="/dashboard/kids" element={<ParkedDashboardFeature title="Kids mode" />} />'),
  "App.jsx missing parked dashboard Kids route",
);

assert.equal(
  /KidsParentHome|KidsUpload|KidsChildHome|KidsLesson/.test(appSource),
  false,
  "App.jsx should not wire live Kids page components during Supabase cutover",
);

console.log("kids-mode-contract-regression.test.mjs passed");
