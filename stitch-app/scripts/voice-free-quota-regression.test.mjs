import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), "utf8");
};

const schemaSource = await read("convex/schema.ts");
if (!schemaSource.includes("consumedVoiceGenerations: v.optional(v.number())")) {
  throw new Error('Expected subscriptions schema to track "consumedVoiceGenerations".');
}

const subscriptionsSource = await read("convex/subscriptions.ts");
for (const pattern of [
  "const FREE_VOICE_GENERATION_LIMIT = 1;",
  "export const getVoiceGenerationQuotaStatus = query({",
  "export const consumeVoiceGenerationCreditOrThrow = mutation({",
  'code: "VOICE_QUOTA_EXCEEDED"',
  "consumedVoiceGenerations: nextUsed",
]) {
  if (!subscriptionsSource.includes(pattern)) {
    throw new Error(`Expected subscriptions.ts to include "${pattern}" for free voice quota.`);
  }
}

const aiSource = await read("convex/ai.ts");
if (!aiSource.includes("api.subscriptions.consumeVoiceGenerationCreditOrThrow")) {
  throw new Error("Expected synthesizeTopicVoice to consume free voice quota credits.");
}
if (!aiSource.includes("consumeQuota: v.optional(v.boolean())")) {
  throw new Error("Expected synthesizeTopicVoice to accept consumeQuota override.");
}
if (!aiSource.includes("if (args.consumeQuota !== false)")) {
  throw new Error("Expected synthesizeTopicVoice to consume quota only when consumeQuota is enabled.");
}
if (!aiSource.includes('if (code === "VOICE_QUOTA_EXCEEDED")')) {
  throw new Error("Expected synthesizeTopicVoice to bypass infra error logging for quota errors.");
}

const playbackSource = await read("src/lib/useVoicePlayback.js");
for (const pattern of [
  "const isVoiceQuotaExceededMessage = (message) => {",
  "remoteStream(firstChunk, { consumeQuota: false })",
  "remoteStream(chunkText, { consumeQuota })",
  "remoteStream(nextChunkText, { consumeQuota: false })",
  "playChunkAtIndex(0, prefetchedFirstChunkPromise, true)",
  "setError(remoteMessage);",
  "setStatus(\"error\");",
  "return false;",
]) {
  if (!playbackSource.includes(pattern)) {
    throw new Error(`Expected useVoicePlayback.js to include "${pattern}" for voice quota handling.`);
  }
}
if (!playbackSource.includes("free ai voice generation")) {
  throw new Error("Expected useVoicePlayback.js to detect free AI voice quota messages.");
}

const topicDetailSource = await read("src/pages/TopicDetail.jsx");
for (const pattern of [
  "api.subscriptions.getVoiceGenerationQuotaStatus",
  "const isVoicePremium = Boolean(voiceQuota?.isPremium);",
  "if (!isVoicePremium) return;",
  "consumeQuota: options.consumeQuota !== false",
]) {
  if (!topicDetailSource.includes(pattern)) {
    throw new Error(`Expected TopicDetail voice flow to include "${pattern}".`);
  }
}

console.log("voice-free-quota-regression.test.mjs passed");
