"use node";

import { Blob } from "node:buffer";

export type DoclingParserId =
    | "enhanced_pdf"
    | "paddleocr_vl"
    | "docx_structured"
    | "image_ocr";

export type DoclingPage = {
    index: number;
    text: string;
    chars?: number;
    tableCount?: number;
    formulaCount?: number;
    source?: string;
};

export type DoclingBlock = {
    id: string;
    page: number;
    blockType: string;
    sectionHint?: string;
    headingPath?: string[];
    text: string;
    startChar?: number;
    endChar?: number;
    flags?: string[];
    source?: string;
};

export type DoclingExtractResponse = {
    backend: "docling";
    kind: string;
    parser: DoclingParserId;
    text: string;
    charCount: number;
    pageCount: number;
    pages: DoclingPage[];
    blocks?: DoclingBlock[];
    warnings?: string[];
    metrics?: {
        tableCount?: number;
        formulaCount?: number;
        chartCount?: number;
    };
};

const DOCLING_ENABLED = ["1", "true", "yes", "on"].includes(
    String(process.env.DOCLING_ENABLED || "").trim().toLowerCase()
);
const DOCLING_EXTRACT_URL = String(process.env.DOCLING_EXTRACT_URL || "").trim();
const DOCLING_TIMEOUT_MS = Number(process.env.DOCLING_TIMEOUT_MS || 120000);
const DOCLING_SHARED_SECRET = String(process.env.DOCLING_SHARED_SECRET || "").trim();

export const isDoclingEnabled = () =>
    DOCLING_ENABLED && Boolean(DOCLING_EXTRACT_URL);

export const callDoclingExtract = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    parser: DoclingParserId;
    maxPages?: number;
}): Promise<DoclingExtractResponse> => {
    if (!isDoclingEnabled()) {
        throw new Error("Docling extraction is not configured.");
    }

    const formData = new FormData();
    const fileBlob = new Blob([args.fileBuffer], { type: args.contentType });
    formData.set("file", fileBlob, args.fileName);
    formData.set("contentType", args.contentType);
    formData.set("profile", args.parser);
    if (Number.isFinite(Number(args.maxPages)) && Number(args.maxPages) > 0) {
        formData.set("maxPages", String(Math.floor(Number(args.maxPages))));
    }

    const controller = new AbortController();
    const timeoutMs = Math.max(5000, Number.isFinite(DOCLING_TIMEOUT_MS) ? DOCLING_TIMEOUT_MS : 120000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(DOCLING_EXTRACT_URL, {
            method: "POST",
            headers: DOCLING_SHARED_SECRET
                ? { "x-docling-shared-secret": DOCLING_SHARED_SECRET }
                : undefined,
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            throw new Error(`Docling extract error: ${response.status} - ${errorBody}`);
        }

        const payload = await response.json();
        if (!payload || typeof payload !== "object") {
            throw new Error("Docling extract error: invalid JSON payload");
        }
        return payload as DoclingExtractResponse;
    } finally {
        clearTimeout(timeoutId);
    }
};
