import { PDFDocument } from "pdf-lib";
import { DEFAULT_MAX_PAGES_PER_REQUEST, splitPdfForOcr } from "./ocrPdfChunks.js";

const DEFAULT_ENDPOINT = "https://api.ocr.space/parse/image";
/** Free tier hard limit (bytes). PRO tiers are higher. */
const FREE_MAX_BYTES = 1 * 1024 * 1024;

const mimeFromMeta = ({ contentType, fileName, fileType } = {}) => {
    const ct = String(contentType || "").toLowerCase();
    if (ct.includes("pdf")) return "application/pdf";
    if (ct.includes("png")) return "image/png";
    if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
    if (ct.includes("gif")) return "image/gif";
    if (ct.includes("tif")) return "image/tiff";
    if (ct.includes("bmp")) return "image/bmp";
    if (ct.includes("webp")) return "image/webp";

    const name = String(fileName || "").toLowerCase();
    if (name.endsWith(".pdf") || String(fileType || "").toLowerCase() === "pdf") {
        return "application/pdf";
    }
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".tif") || name.endsWith(".tiff")) return "image/tiff";
    if (name.endsWith(".bmp")) return "image/bmp";
    return "application/pdf";
};

const filetypeParam = (mime) => {
    if (mime === "application/pdf") return "PDF";
    if (mime === "image/png") return "PNG";
    if (mime === "image/jpeg") return "JPG";
    if (mime === "image/gif") return "GIF";
    if (mime === "image/tiff") return "TIF";
    if (mime === "image/bmp") return "BMP";
    return "PDF";
};

export const extractTextFromOcrSpaceResult = (data) => {
    const parts = [];
    const results = Array.isArray(data?.ParsedResults) ? data.ParsedResults : [];
    for (const item of results) {
        const text = String(item?.ParsedText || "").trim();
        if (text) parts.push(text);
    }
    return parts.join("\n\n").trim();
};

export const isOcrSpaceEnabled = () =>
    Boolean(String(process.env.OCR_SPACE_API_KEY || "").trim());

/**
 * OCR via OCR.space free/PRO API.
 * Returns { text, skipped, reason?, backend, parser, pageCount, warnings }.
 */
const maxBytesLimit = () =>
    Number(process.env.OCR_SPACE_MAX_BYTES || FREE_MAX_BYTES) || FREE_MAX_BYTES;
const maxPagesLimit = () =>
    Number(process.env.OCR_SPACE_MAX_PAGES || DEFAULT_MAX_PAGES_PER_REQUEST) || DEFAULT_MAX_PAGES_PER_REQUEST;

const pdfPageCount = async (buffer) => {
    try {
        return (await PDFDocument.load(buffer, { ignoreEncryption: true })).getPageCount();
    } catch {
        return null;
    }
};

/**
 * OCRs a file. PDFs over the per-request size or page limit are split into
 * page groups (see ocrPdfChunks.js) and OCR'd group by group.
 */
export const callOcrSpace = async (input = {}) => {
    const buffer = Buffer.from(input.fileBuffer || []);
    const mime = mimeFromMeta(input);
    if (!String(process.env.OCR_SPACE_API_KEY || "").trim() || mime !== "application/pdf" || buffer.length === 0) {
        return ocrSingleRequest(input);
    }
    const maxBytes = maxBytesLimit();
    const maxPages = maxPagesLimit();
    const pages = await pdfPageCount(buffer);
    if (buffer.length <= maxBytes && (pages == null || pages <= maxPages)) {
        return ocrSingleRequest(input);
    }
    if (pages == null) return ocrSingleRequest(input); // Unreadable by pdf-lib: let OCR.space decide.

    const { chunks, pageCount, skippedPages, truncated } = await splitPdfForOcr(buffer, { maxBytes, maxPages });
    if (chunks.length === 0) {
        throw new Error(`every page is over ${Math.round(maxBytes / (1024 * 1024))}MB, the OCR.space per-request limit`);
    }
    // Two requests at a time keeps long scans inside the function time limit
    // without tripping OCR.space's free-tier rate limit; results stay in order.
    const results = new Array(chunks.length);
    let next = 0;
    const worker = async () => {
        while (next < chunks.length) {
            const index = next;
            next += 1;
            results[index] = await ocrSingleRequest({ ...input, fileBuffer: chunks[index].buffer });
        }
    };
    await Promise.all([worker(), worker()]);
    const texts = results.map((result) => result.text).filter(Boolean);
    const warnings = results.flatMap((result) => result.warnings || []);
    const parser = results.find((result) => result.parser)?.parser || "ocr.space";
    if (skippedPages.length) {
        warnings.push(`Pages ${skippedPages.map((page) => page + 1).join(", ")} are too large to OCR and were skipped.`);
    }
    if (truncated) {
        warnings.push(`Only the first ${chunks.reduce((sum, chunk) => sum + chunk.pages.length, 0) + skippedPages.length} of ${pageCount} pages were OCR'd.`);
    }
    warnings.push(`OCR ran in ${chunks.length} parts to stay within OCR.space limits.`);
    return {
        text: texts.join("\n\n").trim(),
        skipped: false,
        backend: "ocr_space",
        parser,
        pageCount,
        warnings,
    };
};

const ocrSingleRequest = async ({
    fileBuffer,
    contentType,
    fileName,
    fileType,
} = {}) => {
    const apiKey = String(process.env.OCR_SPACE_API_KEY || "").trim();
    const endpoint = String(process.env.OCR_SPACE_ENDPOINT || DEFAULT_ENDPOINT)
        .trim()
        .replace(/\/+$/, "");
    const language = String(process.env.OCR_SPACE_LANGUAGE || "eng").trim() || "eng";
    const engine = String(process.env.OCR_SPACE_ENGINE || "2").trim() || "2";

    if (!apiKey) {
        return {
            text: "",
            skipped: true,
            reason: "missing_ocr_space_env",
            backend: "ocr_space",
            parser: "ocr.space",
            pageCount: null,
            warnings: [],
        };
    }

    const buffer = Buffer.from(fileBuffer || []);
    if (buffer.length === 0) {
        throw new Error("OCR.space error: empty file buffer");
    }

    const maxBytes = maxBytesLimit();
    if (buffer.length > maxBytes) {
        throw new Error(
            `OCR.space free tier rejects files over ${Math.round(maxBytes / (1024 * 1024))}MB ` +
                `(got ${(buffer.length / (1024 * 1024)).toFixed(2)}MB). ` +
                "Upload a smaller scan, split pages, or upgrade OCR.space.",
        );
    }

    const mime = mimeFromMeta({ contentType, fileName, fileType });
    const base64Image = `data:${mime};base64,${buffer.toString("base64")}`;

    const body = new URLSearchParams();
    body.set("base64Image", base64Image);
    body.set("language", language);
    body.set("isOverlayRequired", "false");
    body.set("scale", "true");
    body.set("isTable", "true");
    body.set("OCREngine", engine);
    body.set("filetype", filetypeParam(mime));
    body.set("detectOrientation", "true");

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    const rawText = await response.text();
    let data;
    try {
        data = JSON.parse(rawText);
    } catch {
        throw new Error(
            `OCR.space error: ${response.status} - non-JSON response`,
        );
    }

    if (!response.ok) {
        const msg =
            (Array.isArray(data?.ErrorMessage) && data.ErrorMessage.join("; ")) ||
            data?.ErrorMessage ||
            rawText.slice(0, 300);
        throw new Error(`OCR.space error: ${response.status} - ${msg}`);
    }

    if (data?.IsErroredOnProcessing) {
        const msg =
            (Array.isArray(data?.ErrorMessage) && data.ErrorMessage.join("; ")) ||
            data?.ErrorMessage ||
            "OCR processing failed";
        throw new Error(`OCR.space processing error: ${msg}`);
    }

    const text = extractTextFromOcrSpaceResult(data);
    const warnings = [];
    const exitCode = Number(data?.OCRExitCode);
    if (exitCode === 2) {
        warnings.push("OCR.space returned a partial result for this document.");
    }
    if (!text && Array.isArray(data?.ParsedResults)) {
        for (const item of data.ParsedResults) {
            const err = String(item?.ErrorMessage || item?.ErrorDetails || "").trim();
            if (err) warnings.push(err);
        }
    }

    return {
        text,
        skipped: false,
        backend: "ocr_space",
        parser: `engine_${engine}`,
        pageCount: Array.isArray(data?.ParsedResults) ? data.ParsedResults.length : null,
        warnings,
    };
};
