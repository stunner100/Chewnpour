import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const [
  libraryPageSource,
  uploadHttpSource,
  uploadsSource,
  downloadHelperSource,
  appSource,
  navSource,
  commandPaletteSource,
] = await Promise.all([
  fs.readFile(path.join(root, "src", "pages", "MyMaterialsLibrary.jsx"), "utf8"),
  fs.readFile(path.join(root, "server", "uploadHttp.js"), "utf8"),
  fs.readFile(path.join(root, "server", "uploads.js"), "utf8"),
  fs.readFile(path.join(root, "src", "lib", "downloadFile.js"), "utf8"),
  fs.readFile(path.join(root, "src", "App.jsx"), "utf8"),
  fs.readFile(path.join(root, "src", "components", "MobileBottomNav.jsx"), "utf8"),
  fs.readFile(path.join(root, "src", "components", "CommandPalette.jsx"), "utf8"),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`${label} should not include "${snippet}".`);
  }
};

requireIncludes(
  libraryPageSource,
  "Download lessons and quizzes from every upload.",
  "MyMaterialsLibrary.jsx",
);
requireIncludes(libraryPageSource, "/api/uploads/${encodeURIComponent(uploadId)}/export", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "/api/uploads/${encodeURIComponent(uploadId)}/original", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "handleDownloadTransformed", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "Download original", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "Download lessons", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "Ready to download", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "is ready to download", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "Nothing to study yet", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "filteredMaterials", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPageSource, "canExport", "MyMaterialsLibrary.jsx");

requireExcludes(libraryPageSource, "Continue Study", "MyMaterialsLibrary.jsx");
requireExcludes(libraryPageSource, "Study Unavailable", "MyMaterialsLibrary.jsx");
requireExcludes(libraryPageSource, "Open lessons", "MyMaterialsLibrary.jsx");
requireExcludes(libraryPageSource, "Manage and study your uploaded files", "MyMaterialsLibrary.jsx");
requireExcludes(libraryPageSource, "from 'convex/react'", "MyMaterialsLibrary.jsx");
requireExcludes(libraryPageSource, "api.uploads.getUserUploads", "MyMaterialsLibrary.jsx");
requireExcludes(libraryPageSource, "Share to Library", "MyMaterialsLibrary.jsx");

requireIncludes(uploadHttpSource, 'parts[1] === "export"', "uploadHttp.js");
requireIncludes(uploadHttpSource, 'parts[1] === "original"', "uploadHttp.js");
requireIncludes(uploadHttpSource, "exportTransformedContentForUser", "uploadHttp.js");
requireIncludes(uploadHttpSource, "getOriginalDownloadForUser", "uploadHttp.js");
requireIncludes(uploadHttpSource, "Content-Disposition", "uploadHttp.js");

requireIncludes(uploadsSource, "export const exportTransformedContentForUser", "uploads.js");
requireIncludes(uploadsSource, "export const getOriginalDownloadForUser", "uploads.js");
requireIncludes(uploadsSource, "canExport:", "uploads.js");
requireIncludes(uploadsSource, "buildTransformedExportZip", "uploads.js");

requireIncludes(downloadHelperSource, "export const downloadAuthenticatedFile", "downloadFile.js");
requireIncludes(downloadHelperSource, "triggerBrowserDownload", "downloadFile.js");

if (!navSource.includes("label: 'My Materials'") || !navSource.includes("path: '/dashboard/library'")) {
  throw new Error("Dashboard navigation should route materials to /dashboard/library.");
}
if (!navSource.includes("Download transformed lessons for every upload")) {
  throw new Error("My Materials nav copy should describe downloads.");
}
if (!commandPaletteSource.includes("value: '/dashboard/library'")) {
  throw new Error("Command palette should route Library to /dashboard/library.");
}
if (!appSource.includes('<Route path="/dashboard/search" element={<Navigate to="/dashboard/library" replace />} />')) {
  throw new Error("Old /dashboard/search route should redirect to /dashboard/library.");
}

console.log("dashboard-library-regression.test.mjs passed");
