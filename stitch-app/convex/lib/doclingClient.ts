"use node";

import { Buffer } from "node:buffer";

export type DoclingExtractResponse = {
    backend: "docling";
    markdown: string;
    text: string;
    warnings: string[];
    metadata?: Record<string, unknown>;
};

const DOCLING_API_BASE_URL = String(process.env.DOCLING_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
const DOCLING_API_KEY = String(process.env.DOCLING_API_KEY || "").trim();
const DOCLING_TIMEOUT_MS = Number(process.env.DOCLING_TIMEOUT_MS || 180000);

const sanitizeText = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const toSafeTimeout = (value?: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return Math.max(30000, DOCLING_TIMEOUT_MS);
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
        throw new Error(`Docling error: ${response.status} - ${bodyText}`);
    }
    if (!bodyText) {
        throw new Error("Docling error: empty response body");
    }
    try {
        return JSON.parse(bodyText);
    } catch (error) {
        throw new Error(
            `Docling error: invalid JSON response (${error instanceof Error ? error.message : String(error)})`
        );
    }
};

const extractWarningList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => sanitizeText(
            typeof entry === "string"
                ? entry
                : String((entry as any)?.message || (entry as any)?.detail || entry || "")
        ))
        .filter(Boolean);
};

const getInBodyDocument = (payload: any) => {
    if (payload?.document && typeof payload.document === "object") {
        return payload.document;
    }
    if (Array.isArray(payload?.documents) && payload.documents[0] && typeof payload.documents[0] === "object") {
        return payload.documents[0];
    }
    if (Array.isArray(payload?.results) && payload.results[0]?.document && typeof payload.results[0].document === "object") {
        return payload.results[0].document;
    }
    return null;
};

export const isDoclingEnabled = () => Boolean(DOCLING_API_BASE_URL);

export const callDoclingExtract = async (args: {
    fileName: string;
    fileBuffer: ArrayBuffer;
    timeoutMs?: number;
}): Promise<DoclingExtractResponse> => {
    if (!isDoclingEnabled()) {
        throw new Error("Docling is not configured.");
    }

    const timeoutMs = toSafeTimeout(args.timeoutMs);
    const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
    };
    if (DOCLING_API_KEY) {
        headers.Authorization = `Bearer ${DOCLING_API_KEY}`;
    }

    const payload = await toJson(await withTimeout(
        `${DOCLING_API_BASE_URL}/v1/convert/source`,
        {
            method: "POST",
            headers,
            body: JSON.stringify({
                options: {
                    to_formats: ["md"],
                    do_ocr: true,
                    do_table_structure: true,
                    md_page_break_placeholder: "\f",
                },
                sources: [{
                    kind: "file",
                    filename: args.fileName,
                    base64_string: Buffer.from(args.fileBuffer).toString("base64"),
                }],
            }),
        },
        timeoutMs
    ));

    const warnings = Array.from(new Set([
        ...extractWarningList(payload?.warnings),
        ...extractWarningList(payload?.errors),
    ]));
    const document = getInBodyDocument(payload);
    const markdown = sanitizeText(
        String(document?.md_content || document?.markdown || document?.text_content || payload?.md_content || "")
    );

    if (!markdown) {
        const responseWarnings = warnings.join("; ");
        const status = sanitizeText(String(payload?.status || ""));
        throw new Error(
            `Docling error: conversion returned empty markdown${status ? ` (status: ${status})` : ""}${responseWarnings ? ` - ${responseWarnings}` : ""}`
        );
    }

    return {
        backend: "docling",
        markdown,
        text: markdown,
        warnings,
        metadata: typeof payload === "object" && payload
            ? {
                status: payload.status,
                processing_time: payload.processing_time,
                timings: payload.timings,
            }
            : undefined,
    };
};
