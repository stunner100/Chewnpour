import assert from "node:assert/strict";
import { resolveCourseSourceStatus } from "../convex/lib/uploadDisplayStatus.js";

assert.equal(
  resolveCourseSourceStatus({
    uploadStatus: "processing",
    processingStep: "ready",
    processingProgress: 100,
  }),
  "ready"
);

assert.equal(
  resolveCourseSourceStatus({
    linkStatus: "processing",
    uploadStatus: "processing",
    processingStep: "ready",
    processingProgress: 100,
  }),
  "ready"
);

assert.equal(
  resolveCourseSourceStatus({
    linkStatus: "processing",
    uploadStatus: "error",
    processingStep: "ready",
    processingProgress: 100,
  }),
  "error"
);

assert.equal(
  resolveCourseSourceStatus({
    uploadStatus: "processing",
    processingStep: "generating_remaining_topics",
    processingProgress: 78,
  }),
  "processing"
);

console.log("course-source-status-regression.test.mjs passed");
