"use node";

import { Blob } from "node:buffer";

export type LlamaParseTier =
    | "fast"
    | "cost_effective"
    | "agentic"
    | "agentic_plus";

export type LlamaParsePage = {
    index: number;
    text: string;
    markdown: string;
    chars: number;
};

export type LlamaParseExtractResponse = {
    backend: "llamaparse";
    tier: LlamaParseTier;
    version: string;
    jobId: string;
    text: string;
    markdown: string;
    pageCount: number;
    pages: LlamaParsePage[];
    warnings?: string[];
};

const LLAMA_CLOUD_API_KEY = String(process.env.LLAMA_CLOUD_API_KEY || "").trim();
const LLAMA_CLOUD_API_BASE_URL = String(
    process.env.LLAMA_CLOUD_API_BASE_URL || "https://api.cloud.llamaindex.ai"
).trim().replace(/\/+$/, "");
const LLAMAPARSE_TIER = String(process.env.LLAMAPARSE_TIER || "cost_effective")
    .trim()
    .toLowerCase() as LlamaParseTier;
const LLAMAPARSE_VERSION = String(process.env.LLAMAPARSE_VERSION || "latest").trim();
const LLAMAPARSE_TIMEOUT_MS = Number(process.env.LLAMAPARSE_TIMEOUT_MS || 180000);
const LLAMAPARSE_POLL_INTERVAL_MS = Number(process.env.LLAMAPARSE_POLL_INTERVAL_MS || 1500);

const sanitizeText = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toSafeTimeout = (value?: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return Math.max(30000, LLAMAPARSE_TIMEOUT_MS);
    }
    return Math.max(30000, Math.floor(parsed));
};

const withTimeout = async (input: string, init: RequestInit, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

const readResponseText = async (response: Response) =>
    await response.text().catch(() => "");

const toJson = async (response: Response) => {
    const bodyText = await readResponseText(response);
    if (!response.ok) {
        throw new Error(`LlamaParse error: ${response.status} - ${bodyText}`);
    }
    if (!bodyText) {
        throw new Error("LlamaParse error: empty response body");
    }
    try {
        return JSON.parse(bodyText);
    } catch (error) {
        throw new Error(
            `LlamaParse error: invalid JSON response (${error instanceof Error ? error.message : String(error)})`
        );
    }
};

export const isLlamaParseEnabled = () =>
    Boolean(LLAMA_CLOUD_API_KEY && LLAMA_CLOUD_API_BASE_URL);

const uploadFileForParse = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    timeoutMs: number;
}) => {
    const formData = new FormData();
    formData.set("file", new Blob([args.fileBuffer], { type: args.contentType }), args.fileName);
    formData.set("purpose", "parse");

    const response = await withTimeout(
        `${LLAMA_CLOUD_API_BASE_URL}/api/v1/beta/files`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
            },
            body: formData,
        },
        args.timeoutMs
    );

    const payload = await toJson(response);
    const fileId = String(payload?.id || "").trim();
    if (!fileId) {
        throw new Error("LlamaParse error: upload response missing file id");
    }
    return fileId;
};

const createParseJob = async (args: {
    fileId: string;
    tier: LlamaParseTier;
    version: string;
    timeoutMs: number;
}) => {
    const response = await withTimeout(
        `${LLAMA_CLOUD_API_BASE_URL}/api/v2/parse`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                file_id: args.fileId,
                tier: args.tier,
                version: args.version,
            }),
        },
        args.timeoutMs
    );

    const payload = await toJson(response);
    const jobId = String(payload?.id || "").trim();
    if (!jobId) {
        throw new Error("LlamaParse error: parse response missing job id");
    }
    return jobId;
};

const pollParseJob = async (args: {
    jobId: string;
    timeoutMs: number;
}) => {
    const deadline = Date.now() + args.timeoutMs;
    const pollIntervalMs = Math.max(500, LLAMAPARSE_POLL_INTERVAL_MS);

    while (Date.now() < deadline) {
        const remainingMs = Math.max(5000, deadline - Date.now());
        const response = await withTimeout(
            `${LLAMA_CLOUD_API_BASE_URL}/api/v2/parse/${args.jobId}?expand=markdown,text,text_full,markdown_full`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
                },
            },
            remainingMs
        );

        const payload = await toJson(response);
        const job = payload?.job || {};
        const status = String(job?.status || "").toUpperCase();
        if (status === "COMPLETED") {
            return payload;
        }
        if (status === "FAILED" || status === "CANCELLED") {
            throw new Error(
                `LlamaParse error: ${String(job?.error_message || payload?.error_message || status)}`
            );
        }

        await sleep(pollIntervalMs);
    }

    throw new Error("LlamaParse error: parse job timed out");
};

const joinFullText = (pages: Array<{ text?: string; markdown?: string }>, key: "text" | "markdown") =>
    sanitizeText(
        (pages || [])
            .map((page) => sanitizeText(String(page?.[key] || "")))
            .filter(Boolean)
            .join("\n\n\f\n\n")
    );

export const callLlamaParseExtract = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    timeoutMs?: number;
    tier?: LlamaParseTier;
    version?: string;
}): Promise<LlamaParseExtractResponse> => {
    if (!isLlamaParseEnabled()) {
        throw new Error("LlamaParse is not configured.");
    }

    const timeoutMs = toSafeTimeout(args.timeoutMs);
    const tier = (String(args.tier || LLAMAPARSE_TIER).trim().toLowerCase() || "cost_effective") as LlamaParseTier;
    const version = String(args.version || LLAMAPARSE_VERSION || "latest").trim() || "latest";

    const fileId = await uploadFileForParse({
        fileName: args.fileName,
        contentType: args.contentType,
        fileBuffer: args.fileBuffer,
        timeoutMs,
    });
    const jobId = await createParseJob({
        fileId,
        tier,
        version,
        timeoutMs,
    });
    const payload = await pollParseJob({
        jobId,
        timeoutMs,
    });

    const textPages = Array.isArray(payload?.text?.pages) ? payload.text.pages : [];
    const markdownPages = Array.isArray(payload?.markdown?.pages) ? payload.markdown.pages : [];
    const pageCount = Math.max(textPages.length, markdownPages.length, 1);
    const pages: LlamaParsePage[] = [];

    for (let index = 0; index < pageCount; index += 1) {
        const textEntry = textPages[index] || {};
        const markdownEntry = markdownPages[index] || {};
        const text = sanitizeText(String(textEntry?.text || ""));
        const markdown = sanitizeText(String(markdownEntry?.markdown || ""));
        const resolvedText = text || markdown;
        if (!resolvedText) continue;
        pages.push({
            index: Math.max(0, Number(textEntry?.page_number || markdownEntry?.page_number || index + 1) - 1),
            text: resolvedText,
            markdown,
            chars: resolvedText.length,
        });
    }

    const text = sanitizeText(String(payload?.text_full || "")) || joinFullText(textPages, "text") || joinFullText(markdownPages, "markdown");
    const markdown = sanitizeText(String(payload?.markdown_full || "")) || joinFullText(markdownPages, "markdown");

    return {
        backend: "llamaparse",
        tier,
        version,
        jobId,
        text,
        markdown,
        pageCount: Math.max(pageCount, pages.length, 1),
        pages,
    };
};
