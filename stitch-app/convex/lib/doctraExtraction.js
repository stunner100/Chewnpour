const DOCTRA_SUPPORTED_MIME_TYPES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOCTRA_SUPPORTED_UPLOAD_FILE_TYPES = new Set(["pdf", "docx"]);

const normalizeExtractedText = (value) => {
    return String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const findFirstString = (value, maxDepth = 6) => {
    if (maxDepth <= 0 || value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findFirstString(item, maxDepth - 1);
            if (found) return found;
        }
        return "";
    }
    if (typeof value === "object") {
        const preferredKeys = ["text", "extractedText", "content", "markdown", "output", "result"];
        for (const key of preferredKeys) {
            const found = findFirstString(value[key], maxDepth - 1);
            if (found) return found;
        }
        for (const key of Object.keys(value)) {
            const found = findFirstString(value[key], maxDepth - 1);
            if (found) return found;
        }
    }
    return "";
};

export const isDoctraSupportedMimeType = (fileType) => {
    return DOCTRA_SUPPORTED_MIME_TYPES.has(String(fileType || "").toLowerCase());
};

export const isDoctraSupportedUploadFileType = (fileType) => {
    return DOCTRA_SUPPORTED_UPLOAD_FILE_TYPES.has(String(fileType || "").toLowerCase());
};

export const parseDoctraExtractionPayload = (payload) => {
    const rawText = findFirstString(payload);
    return normalizeExtractedText(rawText);
};
