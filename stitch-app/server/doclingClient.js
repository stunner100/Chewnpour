import { Blob } from "node:buffer";

const DOCLING_ENABLED = ["1", "true", "yes", "on"].includes(
    String(process.env.DOCLING_ENABLED || "").trim().toLowerCase(),
);
const DOCLING_EXTRACT_URL = String(process.env.DOCLING_EXTRACT_URL || "").trim();
const DOCLING_TIMEOUT_MS = Number(process.env.DOCLING_TIMEOUT_MS || 120000);
const DOCLING_SHARED_SECRET = String(process.env.DOCLING_SHARED_SECRET || "").trim();

export const isDoclingEnabled = () =>
    DOCLING_ENABLED && Boolean(DOCLING_EXTRACT_URL);

const isHtmlErrorBody = (value) =>
    /<!doctype html|<html[\s>]/i.test(String(value || ""));

const summarizeDoclingHttpError = (status, body) => {
    if (status === 504) return "gateway timeout";
    if (status === 502 || status === 503) return "service temporarily unavailable";
    if (isHtmlErrorBody(body)) return "HTML error page";
    return String(body || "empty error response").replace(/\s+/g, " ").trim().slice(0, 300);
};

export const resolveDoclingParser = ({ fileType = "", contentType = "", fileName = "" }) => {
    const source = `${fileType} ${contentType} ${fileName}`.toLowerCase();
    if (source.includes("docx") || source.includes("wordprocessingml")) {
        return "docx_structured";
    }
    if (source.includes("image") || /\.(png|jpe?g|webp)\b/.test(source)) {
        return "image_ocr";
    }
    return "enhanced_pdf";
};

export const isDoclingExtractable = ({ fileType = "", contentType = "", fileName = "" }) => {
    const source = `${fileType} ${contentType} ${fileName}`.toLowerCase();
    if (/\b(mp3|m4a|mp4|wav|webm|ogg|aac|flac|audio)\b/.test(source)) {
        return false;
    }
    return (
        source.includes("pdf") ||
        source.includes("docx") ||
        source.includes("pptx") ||
        source.includes("presentation") ||
        source.includes("wordprocessingml") ||
        source.includes("image") ||
        /\.(png|jpe?g|webp)\b/.test(source)
    );
};

export const callDoclingExtract = async ({
    fileName,
    contentType,
    fileBuffer,
    parser,
    maxPages,
}) => {
    if (!isDoclingEnabled()) {
        throw new Error("Docling extraction is not configured.");
    }

    const formData = new FormData();
    const fileBlob = new Blob([fileBuffer], { type: contentType || "application/octet-stream" });
    formData.set("file", fileBlob, fileName);
    formData.set("contentType", contentType || "application/octet-stream");
    formData.set("profile", parser);
    if (Number.isFinite(Number(maxPages)) && Number(maxPages) > 0) {
        formData.set("maxPages", String(Math.floor(Number(maxPages))));
    }

    const controller = new AbortController();
    const timeoutMs = Math.max(
        5000,
        Number.isFinite(DOCLING_TIMEOUT_MS) ? DOCLING_TIMEOUT_MS : 120000,
    );
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
            throw new Error(
                `Docling extract error: ${response.status} - ${summarizeDoclingHttpError(response.status, errorBody)}`,
            );
        }

        const payload = await response.json();
        if (!payload || typeof payload !== "object") {
            throw new Error("Docling extract error: invalid JSON payload");
        }
        return payload;
    } finally {
        clearTimeout(timeoutId);
    }
};
