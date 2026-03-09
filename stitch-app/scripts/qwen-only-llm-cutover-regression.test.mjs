import fs from "node:fs/promises";
import path from "node:path";

const read = async (relativePath) => {
    const absolutePath = path.resolve(relativePath);
    return fs.readFile(absolutePath, "utf8");
};

const aiSource = await read("convex/ai.ts");
const envExample = await read(".env.example");

if (!aiSource.includes("const DEFAULT_MODEL = INCEPTION_MODEL;")) {
    throw new Error("Expected DEFAULT_MODEL to use INCEPTION_MODEL.");
}

if (!aiSource.includes("INCEPTION_API_KEY environment variable not set.")) {
    throw new Error("Expected Inception-only API key validation error.");
}

if (!aiSource.includes("max_tokens: options?.maxTokens ?? 2048")) {
    throw new Error("Expected Inception chat completions to use max_tokens.");
}

if (!aiSource.includes("const retryableStatuses = new Set([429, 500, 503]);")) {
    throw new Error("Expected Inception client to retry documented transient statuses.");
}

if (!aiSource.includes("inception API error:")) {
    throw new Error("Expected Inception-specific API error formatting in convex/ai.ts.");
}

if (aiSource.includes("OPENAI_API_KEY")) {
    throw new Error("OpenAI API key references should be removed from convex/ai.ts.");
}

if (aiSource.includes("OPENAI_BASE_URL") || aiSource.includes("OPENAI_MODEL")) {
    throw new Error("OpenAI provider constants should be removed from convex/ai.ts.");
}

if (aiSource.includes("primary_provider_failed_using_fallback")) {
    throw new Error("Fallback router log should be removed for Inception-only cutover.");
}

if (envExample.includes("OPENAI_API_KEY") || envExample.includes("OPENAI_BASE_URL") || envExample.includes("OPENAI_MODEL")) {
    throw new Error(".env.example should not include OpenAI variables after Inception-only cutover.");
}

if (envExample.includes("QWEN_API_KEY=") || envExample.includes("QWEN_BASE_URL=") || envExample.includes("QWEN_MODEL=")) {
    throw new Error(".env.example should not include legacy QWEN variables after Inception cutover.");
}

if (!envExample.includes("INCEPTION_API_KEY=") || !envExample.includes("INCEPTION_BASE_URL=") || !envExample.includes("INCEPTION_MODEL=")) {
    throw new Error(".env.example must include required Inception variables.");
}

console.log("inception-only-llm-cutover-regression tests passed");
