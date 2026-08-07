import {
    formatFromBytes,
    formatFromExtension,
    toMarkdownBytes,
} from "@firecrawl/anydoc";

const ANYDOC_FORMATS = new Set(["pdf", "docx", "pptx"]);

const sourceFingerprint = ({ fileType = "", contentType = "", fileName = "" } = {}) =>
    `${fileType} ${contentType} ${fileName}`.toLowerCase();

export class AnydocExtractError extends Error {
    constructor(message, { code } = {}) {
        super(message);
        this.name = "AnydocExtractError";
        this.code = code || null;
    }
}

export const isAnydocUnsupportedError = (error) =>
    Boolean(error && (error.code === "unsupported" || error.isUnsupported));

export const isAnydocExtractable = ({
    fileType = "",
    contentType = "",
    fileName = "",
} = {}) => {
    const source = sourceFingerprint({ fileType, contentType, fileName });
    if (/\b(mp3|m4a|mp4|wav|webm|ogg|aac|flac|audio)\b/.test(source)) {
        return false;
    }
    if (source.includes("image") || /\.(png|jpe?g|webp|gif)\b/.test(source)) {
        return false;
    }
    return (
        source.includes("pdf") ||
        source.includes("docx") ||
        source.includes("wordprocessingml") ||
        source.includes("pptx") ||
        source.includes("presentationml") ||
        /\.(pdf|docx|pptx)\b/.test(source)
    );
};

export const resolveAnydocFormat = ({
    fileType = "",
    contentType = "",
    fileName = "",
    fileBuffer,
} = {}) => {
    const extensionMatch = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    if (extensionMatch) {
        const fromExtension = formatFromExtension(extensionMatch[1]);
        if (fromExtension && ANYDOC_FORMATS.has(fromExtension)) {
            return fromExtension;
        }
    }

    const source = sourceFingerprint({ fileType, contentType, fileName });
    if (source.includes("docx") || source.includes("wordprocessingml")) {
        return "docx";
    }
    if (source.includes("pptx") || source.includes("presentationml")) {
        return "pptx";
    }
    if (source.includes("pdf")) {
        return "pdf";
    }

    if (fileBuffer) {
        const bytes = Buffer.isBuffer(fileBuffer)
            ? fileBuffer
            : Buffer.from(fileBuffer);
        const detected = formatFromBytes(bytes);
        if (detected && ANYDOC_FORMATS.has(detected)) {
            return detected;
        }
    }

    return null;
};

export const callAnydocExtract = async ({
    fileName,
    contentType,
    fileType,
    fileBuffer,
} = {}) => {
    if (!fileBuffer || !(fileBuffer.byteLength || fileBuffer.length)) {
        throw new AnydocExtractError("Anydoc extract error: empty file buffer", {
            code: "malformed",
        });
    }

    const bytes = Buffer.isBuffer(fileBuffer)
        ? fileBuffer
        : Buffer.from(fileBuffer);
    const format = resolveAnydocFormat({
        fileName,
        contentType,
        fileType,
        fileBuffer: bytes,
    });

    try {
        const markdown = format
            ? await toMarkdownBytes(bytes, format)
            : await toMarkdownBytes(bytes);
        const text = String(markdown || "").trim();
        const warnings = [];
        if (!text) {
            warnings.push(
                "Anydoc returned empty Markdown for this document.",
            );
        }
        return {
            text,
            pageCount: null,
            backend: "anydoc",
            parser: format ? `anydoc_${format}` : "anydoc",
            warnings,
        };
    } catch (error) {
        const code = error?.code || null;
        const detail = error?.message || String(error);
        const wrapped = new AnydocExtractError(
            `Anydoc extract error${code ? ` (${code})` : ""}: ${detail}`,
            { code },
        );
        if (code === "unsupported") {
            wrapped.isUnsupported = true;
        }
        throw wrapped;
    }
};
