import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, "convex", "ai.ts"), "utf8");
const topicsSource = await fs.readFile(path.join(root, "convex", "topics.ts"), "utf8");

if (!/buildTopicContextFromChunkIds\s*=\s*\([\s\S]*buildSemanticChunks/.test(aiSource)) {
    throw new Error("Expected chunk-ID topic context remap to use semantic chunks.");
}
if (!/sourcePassageIds:\s*sourcePassageIdList/.test(aiSource)) {
    throw new Error("Expected generated topics to persist aligned sourcePassageIds.");
}
if (!aiSource.includes("retrieveGroundedEvidence({")) {
    throw new Error("Expected topic generation to align source passages via grounded retrieval.");
}
if (!aiSource.includes("safeTopicTitle,")
    || !aiSource.includes("(topicData.subtopics || []).join(\" \")")
    || !aiSource.includes("(topicData.learningObjectives || []).join(\" \")")) {
    throw new Error("Expected topic generation retrieval queries to include structured topic hints.");
}
if (!/sourcePassageIds:\s*v\.optional\(v\.array\(v\.string\(\)\)\)/.test(topicsSource)) {
    throw new Error("Expected topics mutation args to include sourcePassageIds.");
}

console.log("topic-source-alignment-regression.test.mjs passed");
