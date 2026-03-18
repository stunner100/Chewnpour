"use node";

import { Blob } from "node:buffer";

export type DoctraParserId =
    | "enhanced_pdf"
    | "paddleocr_vl"
    | "docx_structured"
    | "image_ocr";

export type DoctraPage = {
    index: number;
    text: string;
    chars?: number;
    tableCount?: number;
    formulaCount?: number;
    source?: string;
};

export type DoctraExtractResponse = {
    backend: "doctra";
    kind: string;
    parser: DoctraParserId;
    text: string;
    charCount: number;
    pageCount: number;
    pages: DoctraPage[];
    warnings?: string[];
    metrics?: {
        tableCount?: number;
        formulaCount?: number;
        chartCount?: number;
    };
};

const DOCTRA_ENABLED = ["1", "true", "yes", "on"].includes(
    String(process.env.DOCTRA_ENABLED || "").trim().toLowerCase()
);
const DOCTRA_EXTRACT_URL = String(process.env.DOCTRA_EXTRACT_URL || "").trim();
const DOCTRA_TIMEOUT_MS = Number(process.env.DOCTRA_TIMEOUT_MS || 120000);
const DOCTRA_SHARED_SECRET = String(process.env.DOCTRA_SHARED_SECRET || "").trim();

export const isDoctraEnabled = () =>
    DOCTRA_ENABLED && Boolean(DOCTRA_EXTRACT_URL);

export const callDoctraExtract = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    parser: DoctraParserId;
    maxPages?: number;
}): Promise<DoctraExtractResponse> => {
    if (!isDoctraEnabled()) {
        throw new Error("Doctra extraction is not configured.");
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
    const timeoutMs = Math.max(5000, Number.isFinite(DOCTRA_TIMEOUT_MS) ? DOCTRA_TIMEOUT_MS : 120000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(DOCTRA_EXTRACT_URL, {
            method: "POST",
            headers: DOCTRA_SHARED_SECRET
                ? { "x-doctra-shared-secret": DOCTRA_SHARED_SECRET }
                : undefined,
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            throw new Error(`Doctra extract error: ${response.status} - ${errorBody}`);
        }

        const payload = await response.json();
        if (!payload || typeof payload !== "object") {
            throw new Error("Doctra extract error: invalid JSON payload");
        }
        return payload as DoctraExtractResponse;
    } finally {
        clearTimeout(timeoutId);
    }
};
