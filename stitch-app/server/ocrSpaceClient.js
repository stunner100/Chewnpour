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
export const callOcrSpace = async ({
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

    const maxBytes =
        Number(process.env.OCR_SPACE_MAX_BYTES || FREE_MAX_BYTES) || FREE_MAX_BYTES;
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
