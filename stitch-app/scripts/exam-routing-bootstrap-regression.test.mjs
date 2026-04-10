import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const aiSource = await fs.readFile(path.join(root, "convex/ai.ts"), "utf8");
const examModeSource = await fs.readFile(path.join(root, "src/pages/ExamMode.jsx"), "utf8");

if (!aiSource.includes("export const ensureAssessmentRoutingForTopic = action({")) {
  throw new Error("ai.ts must expose an assessment-routing bootstrap action for legacy topics.");
}

if (!aiSource.includes("syncAssessmentRoutingForUpload(ctx")) {
  throw new Error("Assessment-routing bootstrap must resync upload routing.");
}

if (!examModeSource.includes("const ensureAssessmentRoutingForTopic = useAction(api.ai.ensureAssessmentRoutingForTopic);")) {
  throw new Error("ExamMode must call the assessment-routing bootstrap action.");
}

if (!examModeSource.includes("Preparing the best assessment route for this topic")) {
  throw new Error("ExamMode must show a routing bootstrap loading state.");
}

if (!examModeSource.includes("routedFinalAssessmentTopic === null")) {
  throw new Error("ExamMode must bootstrap when no final assessment topic exists for the upload.");
}

console.log("exam-routing-bootstrap-regression.test.mjs passed");
