import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const [libraryPageSource, libraryConvexSource, schemaSource, dashboardLayoutSource, appSource, commandPaletteSource] = await Promise.all([
  fs.readFile(path.join(root, "src", "pages", "MyMaterialsLibrary.jsx"), "utf8"),
  fs.readFile(path.join(root, "convex", "library.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "schema.ts"), "utf8"),
  fs.readFile(path.join(root, "src", "components", "DashboardLayout.jsx"), "utf8"),
  fs.readFile(path.join(root, "src", "App.jsx"), "utf8"),
  fs.readFile(path.join(root, "src", "components", "CommandPalette.jsx"), "utf8"),
]);

for (const requiredPattern of [
  "api.uploads.getUserUploads",
  "api.courses.getUserCourses",
  "filteredMaterials",
  "material.courseId",
  "const hasGeneratedContent = ready && material.courseId && material.topicCount > 0",
  "No study content",
]) {
  if (!libraryPageSource.includes(requiredPattern)) {
    throw new Error(`Expected MyMaterialsLibrary.jsx to include "${requiredPattern}" for real materials behavior.`);
  }
}

if (libraryPageSource.includes("const studyHref = material.courseId ? `/dashboard/lessons?courseId=${material.courseId}` : '/dashboard/upload';")) {
  throw new Error("Ready materials with zero generated topics should not route to lessons or upload as Continue Study.");
}

for (const removedPattern of [
  "api.library.generateMaterialUploadUrl",
  "api.library.createMaterial",
  "Share to Library",
  "api.search.searchDashboardContent",
  "Results for",
  "Search courses, topics, or notes...",
]) {
  if (libraryPageSource.includes(removedPattern)) {
    throw new Error(`MyMaterialsLibrary.jsx should not include old library/search behavior "${removedPattern}".`);
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

if (!dashboardLayoutSource.includes("{ label: 'My Materials', icon: 'folder', path: '/dashboard/library' }")) {
  throw new Error("Dashboard navigation should route materials to /dashboard/library.");
}

if (!commandPaletteSource.includes("value: '/dashboard/library'")) {
  throw new Error("Command palette should route Library to /dashboard/library.");
}

if (!appSource.includes('<Route path="/dashboard/search" element={<Navigate to="/dashboard/library" replace />} />')) {
  throw new Error("Old /dashboard/search route should redirect to /dashboard/library.");
}

console.log("dashboard-library-regression.test.mjs passed");
