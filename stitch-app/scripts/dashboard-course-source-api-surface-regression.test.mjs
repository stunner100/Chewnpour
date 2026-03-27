import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const read = (relativePath) => fs.readFile(path.join(root, relativePath), "utf8");

const [dashboardCourseSource, coursesSource, aiSource, schemaSource] = await Promise.all([
  read("src/pages/DashboardCourse.jsx"),
  read("convex/courses.ts"),
  read("convex/ai.ts"),
  read("convex/schema.ts"),
]);

const dashboardExpectations = [
  "api.courses.getCourseSources",
  "api.courses.addUploadToCourse",
  "api.courses.removeSourceFromCourse",
  "api.ai.addSourceToCourse",
];

for (const snippet of dashboardExpectations) {
  if (!dashboardCourseSource.includes(snippet)) {
    throw new Error(`DashboardCourse is missing expected API usage: ${snippet}`);
  }
}

if (dashboardCourseSource.includes("fileUrl: uploadUrl")) {
  throw new Error("DashboardCourse source uploads must not pass fileUrl to uploads.createUpload.");
}

if (!dashboardCourseSource.includes("storageId,")) {
  throw new Error("DashboardCourse source uploads must pass storageId to uploads.createUpload.");
}

const coursesExpectations = [
  "export const getCourseSources = query({",
  "export const addUploadToCourse = mutation({",
  "export const removeSourceFromCourse = mutation({",
  "export const updateCourseUploadStatus = internalMutation({",
  '.query("courseUploads")',
  '.withIndex("by_courseId_uploadId"',
];

for (const snippet of coursesExpectations) {
  if (!coursesSource.includes(snippet)) {
    throw new Error(`courses.ts is missing expected source-management snippet: ${snippet}`);
  }
}

const aiExpectations = [
  "export const addSourceToCourse = action({",
  "internal.courses.updateCourseUploadStatus",
  "runForegroundExtraction",
  'processingStep: "ready"',
];

for (const snippet of aiExpectations) {
  if (!aiSource.includes(snippet)) {
    throw new Error(`ai.ts is missing expected additive-source snippet: ${snippet}`);
  }
}

const schemaExpectations = [
  "courseUploads: defineTable({",
  '.index("by_courseId_uploadId", ["courseId", "uploadId"])',
  '.index("by_uploadId", ["uploadId"])',
];

for (const snippet of schemaExpectations) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`schema.ts is missing expected courseUploads snippet: ${snippet}`);
  }
}

console.log("dashboard-course-source-api-surface-regression.test.mjs passed");
