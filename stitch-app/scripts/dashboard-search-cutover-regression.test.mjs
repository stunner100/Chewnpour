import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const [dashboardSearchSource, searchSource, coursesSource, topicsSource, topicNotesSource, extractionStateSource] = await Promise.all([
  fs.readFile(path.join(root, "src", "pages", "DashboardSearch.jsx"), "utf8"),
  fs.readFile(path.join(root, "convex", "search.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "courses.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "topics.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "topicNotes.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "extractionState.ts"), "utf8"),
]);

if (dashboardSearchSource.includes("api.courses.getUserCourses")) {
  throw new Error("DashboardSearch.jsx should no longer use client-side course filtering.");
}

for (const requiredPattern of [
  "api.search.searchDashboardContent",
  "Search courses, topics, or notes...",
  "RESULT_GROUPS",
  "groupedResults = RESULT_GROUPS.map",
]) {
  if (!dashboardSearchSource.includes(requiredPattern)) {
    throw new Error(`Expected DashboardSearch.jsx to include "${requiredPattern}" for server-side search cutover.`);
  }
}

const normalizedQueryDeclaration = dashboardSearchSource.indexOf("const normalizedQuery = query.trim();");
const debounceEffect = dashboardSearchSource.indexOf("window.setTimeout");
if (normalizedQueryDeclaration === -1 || debounceEffect === -1 || normalizedQueryDeclaration > debounceEffect) {
  throw new Error("DashboardSearch.jsx must declare normalizedQuery before the debounce effect uses it.");
}

for (const requiredPattern of [
  "export const searchDashboardContent = query({",
  '.withSearchIndex("search_body"',
  "export const upsertSearchDocumentsForEntity = internalAction({",
  "export const backfillSearchDocuments = internalAction({",
  "searchZeroResults",
  "searchLatencyMs",
]) {
  if (!searchSource.includes(requiredPattern)) {
    throw new Error(`Expected search.ts to include "${requiredPattern}" for search indexing/querying.`);
  }
}

for (const [sourceName, source] of [
  ["courses.ts", coursesSource],
  ["topics.ts", topicsSource],
  ["topicNotes.ts", topicNotesSource],
  ["extractionState.ts", extractionStateSource],
]) {
  if (!source.includes("search.upsertSearchDocumentsForEntity")) {
    throw new Error(`Expected ${sourceName} to sync search documents on content changes.`);
  }
}

if (!topicNotesSource.includes("search.deleteSearchDocumentsForEntity")) {
  throw new Error("Expected topicNotes.ts to remove search documents when notes are deleted.");
}

console.log("dashboard-search-cutover-regression.test.mjs passed");
