const ANYDOC_FORMATS = new Set(["pdf", "docx", "pptx"]);

let anydocModulePromise = null;

const loadAnydoc = async () => {
    if (!anydocModulePromise) {
        anydocModulePromise = import("@firecrawl/anydoc").catch((error) => {
            anydocModulePromise = null;
            throw error;
        });
    }
    return anydocModulePromise;
};

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

const resolveFormatFromMeta = ({ fileType = "", contentType = "", fileName = "" } = {}) => {
    const extensionMatch = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    if (extensionMatch) {
        const ext = extensionMatch[1];
        if (ext === "pdf" || ext === "docx" || ext === "pptx") {
            return ext;
        }
        if (ext === "docm") return "docx";
        if (ext === "pptm" || ext === "ppsx" || ext === "ppsm") return "pptx";
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
    return null;
};

export const resolveAnydocFormat = ({
    fileType = "",
    contentType = "",
    fileName = "",
} = {}) => resolveFormatFromMeta({ fileType, contentType, fileName });

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

    let anydoc;
    try {
        anydoc = await loadAnydoc();
    } catch (error) {
        throw new AnydocExtractError(
            `Anydoc extract error (load): ${error?.message || String(error)}`,
            { code: "io" },
        );
    }

    const { formatFromBytes, toMarkdownBytes } = anydoc;
    let format = resolveFormatFromMeta({ fileName, contentType, fileType });
    if (!format) {
        const detected = formatFromBytes(bytes);
        if (detected && ANYDOC_FORMATS.has(detected)) {
            format = detected;
        }
    }

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
