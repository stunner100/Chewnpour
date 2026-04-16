import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiFilePath = path.resolve(__dirname, "../convex/ai.ts");
const aiSource = fs.readFileSync(aiFilePath, "utf8");

const callMatch = aiSource.match(
    /updateTopicAssessmentRoutingInternal,\s*\{([\s\S]*?)\}\s*\);/
);

if (!callMatch) {
    throw new Error("Could not find updateTopicAssessmentRoutingInternal call in convex/ai.ts");
}

const callPayload = callMatch[1];

if (/\.\.\.\s*routing/.test(callPayload)) {
    throw new Error("Routing mutation payload must not spread the full routing object.");
}

const requiredFields = [
    "topicKind: routing.topicKind",
    "assessmentClassification: routing.assessmentClassification",
    "assessmentRoute: routing.assessmentRoute",
    "assessmentRouteReason: routing.assessmentRouteReason",
    "assessmentReadinessScore: routing.assessmentReadinessScore",
    "evidenceVolumeScore: routing.evidenceVolumeScore",
    "evidenceDiversityScore: routing.evidenceDiversityScore",
    "distinctivenessScore: routing.distinctivenessScore",
    "questionVarietyScore: routing.questionVarietyScore",
    "redundancyRiskScore: routing.redundancyRiskScore",
];

for (const field of requiredFields) {
    if (!callPayload.includes(field)) {
        throw new Error(`Missing required routing payload field mapping: ${field}`);
    }
}

console.log("assessment-routing-payload-regression tests passed");
