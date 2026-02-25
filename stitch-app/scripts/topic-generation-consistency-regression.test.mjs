import fs from "node:fs/promises";
import path from "node:path";

const read = async (relativePath) => {
    const absolutePath = path.resolve(relativePath);
    return fs.readFile(absolutePath, "utf8");
};

const aiSource = await read("convex/ai.ts");

if (!aiSource.includes("const clientExtractedText = (providedText || \"\").trim();")) {
    throw new Error("Expected processUploadedFile to capture client preview text separately.");
}

if (!aiSource.includes("let extractedText = \"\";")) {
    throw new Error("Expected processUploadedFile to initialize extractedText independently from client preview.");
}

if (aiSource.includes("let extractedText = (providedText || \"\").trim();")) {
    throw new Error("Client preview text should not be the primary extraction source.");
}

if (!aiSource.includes("[Extraction] client_preview_fallback_used")) {
    throw new Error("Expected explicit fallback marker when client preview text is used.");
}

if (!aiSource.includes("extractOutlineFallbackSplitPoints(extractedText, 4)")) {
    throw new Error("Expected fallback topic split points derived from extracted source text.");
}

if (!aiSource.includes("const splitSource = [...baseKeyPoints, ...fallbackSplitPoints]")) {
    throw new Error("Expected topic splitting to merge LLM key points with source-text fallback points.");
}

console.log("topic-generation-consistency-regression tests passed");
