import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath) => {
  const fullPath = resolve(root, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const appSource = read("src/App.jsx");
const schemaSource = read("convex/schema.ts");
const kidsSource = read("convex/kids.ts");
const kidsPageSource = read("src/pages/Kids.jsx");

for (const route of [
  '<Route path="/kids" element={withSuspense(<KidsParentHome />)} />',
  '<Route path="/kids/parent" element={withSuspense(<KidsParentHome />)} />',
  '<Route path="/kids/upload" element={withSuspense(<KidsUpload />)} />',
  '<Route path="/kids/child" element={withSuspense(<KidsChildHome />)} />',
  '<Route path="/kids/lesson/:lessonId" element={withSuspense(<KidsLesson />)} />',
]) {
  assert.ok(appSource.includes(route), `App.jsx missing Kids route: ${route}`);
}

for (const tableName of ["kidProfiles", "kidMaterials", "kidLessons"]) {
  assert.ok(
    schemaSource.includes(`${tableName}: defineTable({`),
    `schema.ts missing ${tableName} table`,
  );
}

for (const fnName of [
  "listProfiles",
  "createProfile",
  "createMaterialFromUpload",
  "listParentLessons",
  "listChildLessons",
  "setLessonVisibility",
  "createStarterLesson",
  "recordHelpRequest",
]) {
  assert.ok(kidsSource.includes(`export const ${fnName}`), `convex/kids.ts missing ${fnName}`);
}

assert.equal(/childId:\s*v\.string\(\)/.test(kidsSource), false, "Kids functions should not trust public string child IDs");
assert.equal(/userId:\s*v\.string\(\)/.test(kidsSource), false, "Kids functions should not trust public user IDs");
assert.equal(/textarea|contentEditable|freeChat|appendMessage/.test(kidsPageSource), false, "Kids UI must not expose open-ended child chat");
assert.ok(kidsPageSource.includes("api.kids.listProfiles"), "Kids UI should read real child profiles");
assert.ok(kidsPageSource.includes("api.kids.createStarterLesson"), "Kids upload flow should create lesson records");
assert.ok(kidsPageSource.includes("api.kids.recordHelpRequest"), "Kids lesson should use preset help buttons");

console.log("kids-mode-contract-regression.test.mjs passed");
