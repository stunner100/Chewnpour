"use node";

import { Blob } from "node:buffer";

export type DataLabMode = "fast" | "balanced" | "accurate";

export type DataLabPage = {
    index: number;
    text: string;
    markdown: string;
    chars: number;
    tableCount: number;
    formulaCount: number;
};

export type DataLabExtractResponse = {
    backend: "datalab";
    mode: DataLabMode;
    requestId: string;
    text: string;
    markdown: string;
    pageCount: number;
    pages: DataLabPage[];
    parseQualityScore: number;
    warnings?: string[];
    metadata?: Record<string, unknown>;
};

const DATALAB_API_KEY = String(process.env.DATALAB_API_KEY || "").trim();
const DATALAB_API_BASE_URL = String(process.env.DATALAB_API_BASE_URL || "https://www.datalab.to")
    .trim()
    .replace(/\/+$/, "");
const DATALAB_TIMEOUT_MS = Number(process.env.DATALAB_TIMEOUT_MS || 240000);
const DATALAB_POLL_INTERVAL_MS = Number(process.env.DATALAB_POLL_INTERVAL_MS || 1500);

const PAGINATED_MARKDOWN_PAGE_PATTERN = /^\{(\d+)\}-{20,}\s*$/gm;

const sanitizeText = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const countMarkdownTables = (value: string) =>
    (String(value || "").match(/^\|.+\|$/gm) || []).length;

const countFormulaMarkers = (value: string) =>
    (String(value || "").match(/\$[^$\n]+\$/g) || []).length;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toSafeTimeout = (value?: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return Math.max(30000, DATALAB_TIMEOUT_MS);
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
        throw new Error(`Datalab error: ${response.status} - ${bodyText}`);
    }
    if (!bodyText) {
        throw new Error("Datalab error: empty response body");
    }
    try {
        return JSON.parse(bodyText);
    } catch (error) {
        throw new Error(
            `Datalab error: invalid JSON response (${error instanceof Error ? error.message : String(error)})`
        );
    }
};

const resolveCheckUrl = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) {
        throw new Error("Datalab error: missing request_check_url");
    }
    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }
    return `${DATALAB_API_BASE_URL}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const parsePaginatedMarkdown = (markdown: string): DataLabPage[] => {
    const source = String(markdown || "");
    const matches = Array.from(source.matchAll(PAGINATED_MARKDOWN_PAGE_PATTERN));
    if (matches.length === 0) {
        const cleaned = sanitizeText(source);
        if (!cleaned) return [];
        return [{
            index: 0,
            text: cleaned,
            markdown: cleaned,
            chars: cleaned.length,
            tableCount: countMarkdownTables(cleaned),
            formulaCount: countFormulaMarkers(cleaned),
        }];
    }

    const pages: DataLabPage[] = [];
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const pageIndex = Math.max(0, Number(match[1] || index));
        const start = match.index! + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index! : source.length;
        const pageMarkdown = sanitizeText(source.slice(start, end));
        if (!pageMarkdown) continue;

        pages.push({
            index: pageIndex,
            text: pageMarkdown,
            markdown: pageMarkdown,
            chars: pageMarkdown.length,
            tableCount: countMarkdownTables(pageMarkdown),
            formulaCount: countFormulaMarkers(pageMarkdown),
        });
    }

    return pages;
};

export const isDataLabEnabled = () =>
    Boolean(DATALAB_API_KEY && DATALAB_API_BASE_URL);

const submitConvertRequest = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    mode: DataLabMode;
    maxPages?: number;
    timeoutMs: number;
}) => {
    const formData = new FormData();
    formData.set("file", new Blob([args.fileBuffer], { type: args.contentType }), args.fileName);
    formData.set("output_format", "markdown");
    formData.set("mode", args.mode);
    formData.set("paginate", "true");
    formData.set("token_efficient_markdown", "true");
    if (Number.isFinite(Number(args.maxPages)) && Number(args.maxPages) > 0) {
        formData.set("max_pages", String(Math.floor(Number(args.maxPages))));
    }

    const response = await withTimeout(
        `${DATALAB_API_BASE_URL}/api/v1/convert`,
        {
            method: "POST",
            headers: {
                "X-API-Key": DATALAB_API_KEY,
            },
            body: formData,
        },
        args.timeoutMs
    );

    const payload = await toJson(response);
    const requestId = String(payload?.request_id || "").trim();
    const requestCheckUrl = resolveCheckUrl(String(payload?.request_check_url || ""));
    if (!requestId) {
        throw new Error("Datalab error: submit response missing request_id");
    }
    return {
        requestId,
        requestCheckUrl,
    };
};

const pollConvertRequest = async (args: {
    requestCheckUrl: string;
    timeoutMs: number;
}) => {
    const deadline = Date.now() + args.timeoutMs;
    const pollIntervalMs = Math.max(500, DATALAB_POLL_INTERVAL_MS);

    while (Date.now() < deadline) {
        const remainingMs = Math.max(5000, deadline - Date.now());
        const response = await withTimeout(
            args.requestCheckUrl,
            {
                method: "GET",
                headers: {
                    "X-API-Key": DATALAB_API_KEY,
                },
            },
            remainingMs
        );
        const payload = await toJson(response);
        const status = String(payload?.status || "").trim().toLowerCase();
        if (status === "complete") {
            return payload;
        }
        if (status === "failed") {
            throw new Error(`Datalab error: ${String(payload?.error || "conversion failed")}`);
        }
        await sleep(pollIntervalMs);
    }

    throw new Error("Datalab error: convert request timed out");
};

export const callDataLabExtract = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    timeoutMs?: number;
    mode?: DataLabMode;
    maxPages?: number;
}): Promise<DataLabExtractResponse> => {
    if (!isDataLabEnabled()) {
        throw new Error("Datalab is not configured.");
    }

    const timeoutMs = toSafeTimeout(args.timeoutMs);
    const mode = (String(args.mode || "accurate").trim().toLowerCase() || "accurate") as DataLabMode;
    const submitted = await submitConvertRequest({
        fileName: args.fileName,
        contentType: args.contentType,
        fileBuffer: args.fileBuffer,
        mode,
        maxPages: args.maxPages,
        timeoutMs,
    });
    const payload = await pollConvertRequest({
        requestCheckUrl: submitted.requestCheckUrl,
        timeoutMs,
    });

    const markdown = sanitizeText(String(payload?.markdown || ""));
    const pages = parsePaginatedMarkdown(markdown);
    const text = sanitizeText(markdown);
    const parseQualityScore = Math.max(0, Number(payload?.parse_quality_score || 0));
    const warnings: string[] = [];
    if (!text) {
        warnings.push("empty_markdown_output");
    }
    if (parseQualityScore > 0 && parseQualityScore < 4) {
        warnings.push(`low_parse_quality_score:${parseQualityScore}`);
    }

    return {
        backend: "datalab",
        mode,
        requestId: submitted.requestId,
        text,
        markdown,
        pageCount: Math.max(Number(payload?.page_count || 0), pages.length, text ? 1 : 0),
        pages,
        parseQualityScore,
        warnings,
        metadata: typeof payload?.metadata === "object" && payload.metadata
            ? payload.metadata as Record<string, unknown>
            : undefined,
    };
};
