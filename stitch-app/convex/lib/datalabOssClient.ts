"use node";

import { Blob } from "node:buffer";

export type DataLabOssParserId = "marker" | "marker_ocr" | "chandra";

export type DataLabOssPage = {
    index: number;
    text: string;
    chars?: number;
    tableCount?: number;
    formulaCount?: number;
    source?: string;
};

export type DataLabOssExtractResponse = {
    backend: "datalab_oss";
    kind: string;
    parser: DataLabOssParserId;
    text: string;
    charCount: number;
    pageCount: number;
    pages: DataLabOssPage[];
    warnings?: string[];
    metrics?: {
        tableCount?: number;
        formulaCount?: number;
        chartCount?: number;
    };
};

const DATALAB_OSS_ENABLED = ["1", "true", "yes", "on"].includes(
    String(process.env.DATALAB_OSS_ENABLED || "").trim().toLowerCase()
);
const DATALAB_OSS_EXTRACT_URL = String(process.env.DATALAB_OSS_EXTRACT_URL || "").trim();
const DATALAB_OSS_TIMEOUT_MS = Number(process.env.DATALAB_OSS_TIMEOUT_MS || 240000);
const DATALAB_OSS_SHARED_SECRET = String(process.env.DATALAB_OSS_SHARED_SECRET || "").trim();

export const isDataLabOssEnabled = () =>
    DATALAB_OSS_ENABLED && Boolean(DATALAB_OSS_EXTRACT_URL);

export const callDataLabOssExtract = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    parser?: DataLabOssParserId;
    maxPages?: number;
}): Promise<DataLabOssExtractResponse> => {
    if (!isDataLabOssEnabled()) {
        throw new Error("Datalab OSS extraction is not configured.");
    }

    const formData = new FormData();
    const fileBlob = new Blob([args.fileBuffer], { type: args.contentType });
    formData.set("file", fileBlob, args.fileName);
    formData.set("contentType", args.contentType);
    if (args.parser) {
        formData.set("profile", args.parser);
    }
    if (Number.isFinite(Number(args.maxPages)) && Number(args.maxPages) > 0) {
        formData.set("maxPages", String(Math.floor(Number(args.maxPages))));
    }

    const controller = new AbortController();
    const timeoutMs = Math.max(5000, Number.isFinite(DATALAB_OSS_TIMEOUT_MS) ? DATALAB_OSS_TIMEOUT_MS : 240000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(DATALAB_OSS_EXTRACT_URL, {
            method: "POST",
            headers: DATALAB_OSS_SHARED_SECRET
                ? { "x-datalab-oss-shared-secret": DATALAB_OSS_SHARED_SECRET }
                : undefined,
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            throw new Error(`Datalab OSS extract error: ${response.status} - ${errorBody}`);
        }

        const payload = await response.json();
        if (!payload || typeof payload !== "object") {
            throw new Error("Datalab OSS extract error: invalid JSON payload");
        }
        return payload as DataLabOssExtractResponse;
    } finally {
        clearTimeout(timeoutId);
    }
};
