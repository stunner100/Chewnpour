import fs from "node:fs/promises";
import path from "node:path";

const read = async (relativePath) => {
    const absolutePath = path.resolve(relativePath);
    return fs.readFile(absolutePath, "utf8");
};

const aiSource = await read("convex/ai.ts");
const envExample = await read(".env.example");

if (!aiSource.includes("const DEFAULT_MODEL = DEEPSEEK_DOCUMENT_FLASH_MODEL;")) {
    throw new Error("Expected DEFAULT_MODEL to use the DeepSeek Flash document model.");
}

if (!aiSource.includes("const BEDROCK_BASE_URL = (() => {")) {
    throw new Error("Expected explicit Bedrock fallback base URL configuration.");
}

if (!aiSource.includes('const BEDROCK_MODEL = String(process.env.BEDROCK_MODEL || "moonshotai.kimi-k2.5").trim() || "moonshotai.kimi-k2.5";')) {
    throw new Error("Expected Bedrock Kimi 2.5 fallback model configuration.");
}

if (!aiSource.includes('const INCEPTION_PRIMARY_FEATURES = new Set([')) {
    throw new Error("Expected an explicit Inception feature-routing set.");
}

if (!aiSource.includes('"assignment_follow_up"') || !aiSource.includes('"topic_tutor"')) {
    throw new Error("Expected assignment and topic chat features to route to Inception.");
}

if (!aiSource.includes('const DEEPSEEK_DOCUMENT_PIPELINE_FEATURES = new Set([')) {
    throw new Error("Expected an explicit DeepSeek document feature-routing set.");
}

if (!aiSource.includes('"course_generation"') || !aiSource.includes('"mcq_generation"') || !aiSource.includes('"essay_generation"')) {
    throw new Error("Expected course, MCQ, and essay generation features to route to DeepSeek.");
}

if (!aiSource.includes("const preferredProvider = resolvePreferredTextProvider();")) {
    throw new Error("Expected provider resolution to use the LLM usage feature context.");
}

if (!aiSource.includes("const bedrockAvailable = Boolean(bedrockApiKey);")) {
    throw new Error("Expected explicit Bedrock availability detection.");
}

if (!aiSource.includes('if (preferredProvider === "inception")')) {
    throw new Error("Expected a dedicated Inception-primary branch for chat features.");
}

if (!aiSource.includes("DEEPSEEK_API_KEY environment variable not set.")) {
    throw new Error("Expected primary DeepSeek API key validation error.");
}

if (!aiSource.includes("DEEPSEEK_BASE_URL environment variable not configured.")) {
    throw new Error("Expected explicit DeepSeek base URL validation error.");
}

if (!aiSource.includes("BEDROCK_API_KEY environment variable not set.")) {
    throw new Error("Expected explicit Bedrock API key validation error.");
}

if (!aiSource.includes("max_tokens: options?.maxTokens ?? 2048")) {
    throw new Error("Expected DeepSeek chat completions to use max_tokens.");
}

if (!aiSource.includes("const retryableStatuses = new Set([429, 500, 503]);")) {
    throw new Error("Expected Inception fallback client to retry transient statuses.");
}

if (!aiSource.includes('primary_provider_failed_using_fallback')) {
    throw new Error("Expected explicit primary-provider fallback logging.");
}

if (!aiSource.includes('invalid_deepseek_base_url')) {
    throw new Error("Expected explicit invalid_deepseek_base_url fallback reason.");
}

if (!aiSource.includes("shouldFallbackToBedrockText({ errorMessage, bedrockAvailable })")) {
    throw new Error("Expected DeepSeek failures to route into Bedrock before Inception.");
}

if (!aiSource.includes("Authorization: `Bearer ${openAiApiKey}`")) {
    throw new Error("Expected bearer authorization for the primary provider.");
}

if (!aiSource.includes("new URL(\"chat/completions\", BEDROCK_BASE_URL).toString()")) {
    throw new Error("Expected Bedrock fallback to use the OpenAI-compatible chat completions endpoint.");
}

if (!aiSource.includes("provider: \"bedrock\"")) {
    throw new Error("Expected Bedrock usage tracking.");
}

if (!aiSource.includes("return callInceptionText();")) {
    throw new Error("Expected fallback path to route into Inception.");
}

if (!aiSource.includes("return callOpenAiWithFallbackText({ allowInceptionFallback: false });")) {
    throw new Error("Expected chat-side fallback path to route into the DeepSeek-led fallback chain.");
}

if (!envExample.includes("DEEPSEEK_API_KEY=") || !envExample.includes("DEEPSEEK_BASE_URL=") || !envExample.includes("DEEPSEEK_DOCUMENT_FLASH_MODEL=") || !envExample.includes("DEEPSEEK_DOCUMENT_PRO_MODEL=")) {
    throw new Error(".env.example must include DeepSeek primary provider variables.");
}

if (!envExample.includes("BEDROCK_API_KEY=") || !envExample.includes("BEDROCK_BASE_URL=") || !envExample.includes("BEDROCK_MODEL=")) {
    throw new Error(".env.example must include Bedrock fallback variables.");
}

if (!envExample.includes("INCEPTION_API_KEY=") || !envExample.includes("INCEPTION_BASE_URL=") || !envExample.includes("INCEPTION_MODEL=")) {
    throw new Error(".env.example must include Inception fallback variables.");
}

if (aiSource.includes("shouldFallbackToGeminiText") || aiSource.includes("callGeminiText(")) {
    throw new Error("Gemini text fallback should be removed from convex/ai.ts.");
}

console.log("openai-primary-inception-fallback-regression: ok");
