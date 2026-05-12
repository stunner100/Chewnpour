import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const [libraryPageSource, libraryConvexSource, schemaSource, dashboardLayoutSource] = await Promise.all([
  fs.readFile(path.join(root, "src", "pages", "DashboardSearch.jsx"), "utf8"),
  fs.readFile(path.join(root, "convex", "library.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "schema.ts"), "utf8"),
  fs.readFile(path.join(root, "src", "components", "DashboardLayout.jsx"), "utf8"),
]);

for (const requiredPattern of [
  "api.library.generateMaterialUploadUrl",
  "api.library.createMaterial",
  "api.library.listMaterials",
  "Upload books and reading materials for everyone to read.",
  "Share to Library",
  "Read",
  "uploadToStorageWithRetry",
]) {
  if (!libraryPageSource.includes(requiredPattern)) {
    throw new Error(`Expected DashboardSearch.jsx to include "${requiredPattern}" for shared library behavior.`);
  }
}

for (const removedPattern of [
  "api.search.searchDashboardContent",
  "Results for",
  "Search courses, topics, or notes...",
]) {
  if (libraryPageSource.includes(removedPattern)) {
    throw new Error(`DashboardSearch.jsx should not include old search behavior "${removedPattern}".`);
  }
}

for (const requiredPattern of [
  "libraryMaterials: defineTable({",
  "storageId: v.id(\"_storage\")",
  ".index(\"by_createdAt\", [\"createdAt\"])",
  ".index(\"by_uploadedBy\", [\"uploadedBy\"])",
]) {
  if (!schemaSource.includes(requiredPattern)) {
    throw new Error(`Expected schema.ts to include "${requiredPattern}" for library materials.`);
  }
}

for (const requiredPattern of [
  "export const generateMaterialUploadUrl = mutation({",
  "export const createMaterial = mutation({",
  "export const listMaterials = query({",
  "ctx.storage.getUrl(row.storageId)",
  "ctx.storage.delete(args.storageId).catch(() => undefined)",
]) {
  if (!libraryConvexSource.includes(requiredPattern)) {
    throw new Error(`Expected library.ts to include "${requiredPattern}".`);
  }
}

if (!dashboardLayoutSource.includes("{ label: 'Library', icon: 'auto_stories', path: '/dashboard/search' }")) {
  throw new Error("Dashboard navigation should keep the Library tab at /dashboard/search.");
}

console.log("dashboard-library-regression.test.mjs passed");
