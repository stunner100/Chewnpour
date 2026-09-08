import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const uiRoot = path.join(root, "src", "components", "opensource-ui");

const read = (relativePath) => fs.readFile(path.join(root, relativePath), "utf8");

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

const files = await fs.readdir(uiRoot);
const sources = await Promise.all(
  files.map(async (file) => ({
    file,
    source: await fs.readFile(path.join(uiRoot, file), "utf8"),
  })),
);

for (const { file, source } of sources) {
  requireExcludes(source, 'from "next/image"', file);
  requireExcludes(source, "from 'next/image'", file);
  requireExcludes(source, 'from "@/lib/cn"', file);
  requireExcludes(source, '"use client"', file);
}

const [
  uploadField,
  libraryPage,
  materialCard,
  progressPage,
  settingsPage,
  uploadPage,
] = await Promise.all([
  read("src/components/opensource-ui/FileUploadFieldInput.tsx"),
  read("src/pages/MyMaterialsLibrary.jsx"),
  read("src/components/materials/MaterialCard.jsx"),
  read("src/pages/StudyProgressMastery.jsx"),
  read("src/pages/AccountStudySettings.jsx"),
  read("src/pages/UploadMaterials.jsx"),
]);

requireIncludes(uploadField, "50 * 1024 * 1024", "FileUploadFieldInput.tsx");
requireIncludes(uploadField, ".pdf,.pptx,.docx", "FileUploadFieldInput.tsx");
requireIncludes(libraryPage, "SegmentedToggleButton", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPage, "FilterSortDropdown", "MyMaterialsLibrary.jsx");
requireIncludes(libraryPage, "SearchInput", "MyMaterialsLibrary.jsx");
requireIncludes(materialCard, "Download original", "MaterialCard.jsx");
requireIncludes(materialCard, "HoldToDeleteButton", "MaterialCard.jsx");
requireIncludes(progressPage, "DailyActivityCalendarWidget", "StudyProgressMastery.jsx");
requireIncludes(progressPage, "ProgressRingCard", "StudyProgressMastery.jsx");
requireIncludes(settingsPage, "KeyboardShortcutsCard", "AccountStudySettings.jsx");
requireIncludes(settingsPage, "PomodoroWidget", "AccountStudySettings.jsx");
requireIncludes(uploadPage, "SpinLoader", "UploadMaterials.jsx");

console.log("opensource-ui-port-regression.test.mjs passed");
