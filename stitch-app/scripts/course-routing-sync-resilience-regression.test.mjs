import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const schemaSource = await fs.readFile(path.join(root, "convex", "schema.ts"), "utf8");
const uploadsSource = await fs.readFile(path.join(root, "convex", "uploads.ts"), "utf8");
const aiSource = await fs.readFile(path.join(root, "convex", "ai.ts"), "utf8");

if (!schemaSource.includes("errorMessage: v.optional(v.string())")) {
  throw new Error("uploads schema must persist upload errorMessage diagnostics.");
}

const uploadStatusExpectations = [
  "status: v.optional(v.string())",
  "if (args.status !== undefined) {",
  "if (args.errorMessage !== undefined) {",
];

for (const snippet of uploadStatusExpectations) {
  if (!uploadsSource.includes(snippet)) {
    throw new Error(`uploads.ts is missing partial status patch support: ${snippet}`);
  }
}

const routingExpectations = [
  "const ROUTING_SYNC_ERROR_PREFIX = \"[routing_sync]\";",
  "const scheduleRoutingSyncRetry = async (ctx: any, args:",
  "const reconcileUploadStatusAfterRoutingSync = async (ctx: any, args:",
  "assessment_routing_sync_failed_nonfatal",
  "await scheduleRoutingSyncRetry(ctx, {",
  "export const retryAssessmentRoutingForUpload = internalAction({",
  "await syncAssessmentRoutingForUpload(ctx, {",
  "const errorMessage = buildRoutingSyncErrorMessage(error);",
];

for (const snippet of routingExpectations) {
  if (!aiSource.includes(snippet)) {
    throw new Error(`ai.ts is missing routing-sync resilience snippet: ${snippet}`);
  }
}

const routingSchemaExpectations = [
  "supportedQuestionTypes: v.optional(v.array(v.string()))",
  "strongestNeighborOverlap: v.optional(v.number())",
];

for (const snippet of routingSchemaExpectations) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`schema.ts is missing routing assessment field support: ${snippet}`);
  }
}

const routingMutationExpectations = [
  "supportedQuestionTypes: args.supportedQuestionTypes",
  "strongestNeighborOverlap: args.strongestNeighborOverlap",
];

const topicsSource = await fs.readFile(path.join(root, "convex", "topics.ts"), "utf8");

for (const snippet of routingMutationExpectations) {
  if (!topicsSource.includes(snippet)) {
    throw new Error(`topics.ts is missing routing assessment patch support: ${snippet}`);
  }
}

if (!aiSource.includes("processingStep: \"first_topic_ready\"")) {
  throw new Error("Course generation must still advance uploads to first_topic_ready after the first topic.");
}

console.log("course-routing-sync-resilience-regression.test.mjs passed");
