import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const schemaSource = await fs.readFile(path.join(root, "convex", "schema.ts"), "utf8");
const foldersSource = await fs.readFile(path.join(root, "convex", "courseFolders.ts"), "utf8");

const schemaExpectations = [
  "folderId: v.optional(v.id(\"courseFolders\"))",
  ".index(\"by_userId_folderId\", [\"userId\", \"folderId\"])",
  "courseFolders: defineTable({",
  "}).index(\"by_userId\", [\"userId\"])",
];

for (const snippet of schemaExpectations) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`schema.ts is missing course folder support: ${snippet}`);
  }
}

const foldersExpectations = [
  "export const listFolders = query({",
  "query(\"courseFolders\")",
  "withIndex(\"by_userId\"",
  "export const moveCourseToFolder = mutation({",
  "withIndex(\"by_userId_folderId\"",
];

for (const snippet of foldersExpectations) {
  if (!foldersSource.includes(snippet)) {
    throw new Error(`courseFolders.ts is missing expected API support: ${snippet}`);
  }
}

console.log("course-folders-api-regression.test.mjs passed");
