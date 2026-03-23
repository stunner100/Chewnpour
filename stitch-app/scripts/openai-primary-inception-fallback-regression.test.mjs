import fs from "node:fs/promises";
import path from "node:path";

const read = async (relativePath) => {
    const absolutePath = path.resolve(relativePath);
    return fs.readFile(absolutePath, "utf8");
};

const aiSource = await read("convex/ai.ts");
const envExample = await read(".env.example");

if (!aiSource.includes("const DEFAULT_MODEL = OPENAI_MODEL;")) {
    throw new Error("Expected DEFAULT_MODEL to use OPENAI_MODEL.");
}

if (!aiSource.includes('const INCEPTION_PRIMARY_FEATURES = new Set([')) {
    throw new Error("Expected an explicit Inception feature-routing set.");
}

if (!aiSource.includes('"assignment_follow_up"') || !aiSource.includes('"topic_tutor"')) {
    throw new Error("Expected assignment and topic chat features to route to Inception.");
}

if (!aiSource.includes('const OPENAI_PRIMARY_FEATURES = new Set([')) {
    throw new Error("Expected an explicit OpenAI feature-routing set.");
}

if (!aiSource.includes('"course_generation"') || !aiSource.includes('"mcq_generation"') || !aiSource.includes('"essay_generation"')) {
    throw new Error("Expected course, MCQ, and essay generation features to route to OpenAI.");
}

if (!aiSource.includes("const preferredProvider = resolvePreferredTextProvider();")) {
    throw new Error("Expected provider resolution to use the LLM usage feature context.");
}

if (!aiSource.includes('if (preferredProvider === "inception")')) {
    throw new Error("Expected a dedicated Inception-primary branch for chat features.");
}

if (!aiSource.includes("OPENAI_API_KEY environment variable not set.")) {
    throw new Error("Expected primary OpenAI API key validation error.");
}

if (!aiSource.includes("OPENAI_BASE_URL environment variable not configured.")) {
    throw new Error("Expected explicit OpenAI base URL validation error.");
}

if (!aiSource.includes("max_completion_tokens: options?.maxTokens ?? 2048")) {
    throw new Error("Expected OpenAI chat completions to use max_completion_tokens.");
}

if (!aiSource.includes("const retryableStatuses = new Set([429, 500, 503]);")) {
    throw new Error("Expected Inception fallback client to retry transient statuses.");
}

if (!aiSource.includes('primary_provider_failed_using_fallback')) {
    throw new Error("Expected explicit primary-provider fallback logging.");
}

if (!aiSource.includes('invalid_openai_base_url')) {
    throw new Error("Expected explicit invalid_openai_base_url fallback reason.");
}

if (!aiSource.includes('"api-key": openAiApiKey')) {
    throw new Error("Expected Azure-compatible api-key header for the primary provider.");
}

if (!aiSource.includes("Authorization: `Bearer ${openAiApiKey}`")) {
    throw new Error("Expected bearer authorization for the primary provider.");
}

if (!aiSource.includes("return callInceptionText();")) {
    throw new Error("Expected fallback path to route into Inception.");
}

if (!aiSource.includes("return callOpenAiText();")) {
    throw new Error("Expected chat-side fallback path to route into OpenAI.");
}

if (!envExample.includes("OPENAI_API_KEY=") || !envExample.includes("OPENAI_BASE_URL=") || !envExample.includes("OPENAI_MODEL=")) {
    throw new Error(".env.example must include OpenAI primary provider variables.");
}

if (!envExample.includes("INCEPTION_API_KEY=") || !envExample.includes("INCEPTION_BASE_URL=") || !envExample.includes("INCEPTION_MODEL=")) {
    throw new Error(".env.example must include Inception fallback variables.");
}

if (aiSource.includes("shouldFallbackToGeminiText") || aiSource.includes("callGeminiText(")) {
    throw new Error("Gemini text fallback should be removed from convex/ai.ts.");
}

console.log("openai-primary-inception-fallback-regression: ok");
