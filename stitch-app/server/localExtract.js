import { Buffer } from "node:buffer";
import { unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";

const decodeXmlEntities = (value = "") =>
    String(value || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => {
            const n = Number(code);
            return Number.isFinite(n) ? String.fromCharCode(n) : "";
        });

const stripXmlToText = (xml = "") =>
    decodeXmlEntities(
        String(xml || "")
            .replace(/<w:tab\b[^>]*\/>/gi, "\t")
            .replace(/<a:br\b[^>]*\/>/gi, "\n")
            .replace(/<w:br\b[^>]*\/>/gi, "\n")
            .replace(/<\/w:p>/gi, "\n")
            .replace(/<\/a:p>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ \t]{2,}/g, " ")
            .trim(),
    );

const sourceFingerprint = ({ fileType = "", contentType = "", fileName = "" }) =>
    `${fileType} ${contentType} ${fileName}`.toLowerCase();

export const isLocalExtractable = ({ fileType = "", contentType = "", fileName = "" } = {}) => {
    const source = sourceFingerprint({ fileType, contentType, fileName });
    if (/\b(mp3|m4a|mp4|wav|webm|ogg|aac|flac|audio)\b/.test(source)) {
        return false;
    }
    // Images need OCR — local text extract cannot help.
    if (source.includes("image") || /\.(png|jpe?g|webp|gif)\b/.test(source)) {
        return false;
    }
    return (
        source.includes("pdf") ||
        source.includes("docx") ||
        source.includes("wordprocessingml") ||
        source.includes("pptx") ||
        source.includes("presentationml") ||
        source.includes("text/plain") ||
        source.includes("text/markdown") ||
        /\.(txt|md|markdown)\b/.test(source)
    );
};

export const resolveLocalParser = ({ fileType = "", contentType = "", fileName = "" } = {}) => {
    const source = sourceFingerprint({ fileType, contentType, fileName });
    if (source.includes("docx") || source.includes("wordprocessingml")) {
        return "docx_local";
    }
    if (source.includes("pptx") || source.includes("presentationml")) {
        return "pptx_local";
    }
    if (
        source.includes("text/plain") ||
        source.includes("text/markdown") ||
        /\.(txt|md|markdown)\b/.test(source)
    ) {
        return "plain_text";
    }
    return "pdf_local";
};

const extractPlainText = (fileBuffer) => {
    const text = Buffer.from(fileBuffer).toString("utf8").trim();
    return {
        text,
        pageCount: null,
        warnings: text ? [] : ["Plain-text file was empty."],
    };
};

const extractPdfText = async (fileBuffer) => {
    const pdf = await getDocumentProxy(new Uint8Array(fileBuffer), { verbosity: 0 });
    try {
        const { text, totalPages } = await extractText(pdf, { mergePages: true });
        const merged = typeof text === "string" ? text.trim() : "";
        const warnings = [];
        if (!merged) {
            warnings.push(
                "No selectable text found. This PDF may be scanned; OCR requires a cloud extractor.",
            );
        }
        return {
            text: merged,
            pageCount: Number.isFinite(Number(totalPages)) ? Number(totalPages) : null,
            warnings,
        };
    } finally {
        await pdf.destroy?.().catch(() => undefined);
    }
};

const extractDocxText = (fileBuffer) => {
    const files = unzipSync(new Uint8Array(fileBuffer));
    const documentXml = files["word/document.xml"];
    if (!documentXml) {
        throw new Error("Invalid DOCX: missing word/document.xml");
    }
    const parts = [stripXmlToText(new TextDecoder().decode(documentXml))];
    for (const [name, bytes] of Object.entries(files)) {
        if (/^word\/(header|footer)\d*\.xml$/i.test(name)) {
            const extra = stripXmlToText(new TextDecoder().decode(bytes));
            if (extra) parts.push(extra);
        }
    }
    const text = parts.filter(Boolean).join("\n\n").trim();
    return {
        text,
        pageCount: null,
        warnings: text ? [] : ["DOCX contained no extractable text."],
    };
};

const extractPptxText = (fileBuffer) => {
    const files = unzipSync(new Uint8Array(fileBuffer));
    const slideNames = Object.keys(files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => {
            const aNum = Number(a.match(/slide(\d+)/i)?.[1] || 0);
            const bNum = Number(b.match(/slide(\d+)/i)?.[1] || 0);
            return aNum - bNum;
        });
    if (slideNames.length === 0) {
        throw new Error("Invalid PPTX: no slides found");
    }
    const parts = [];
    for (const name of slideNames) {
        const slideText = stripXmlToText(new TextDecoder().decode(files[name]));
        if (slideText) parts.push(slideText);
        const slideNum = name.match(/slide(\d+)/i)?.[1];
        const notesName = slideNum ? `ppt/notesSlides/notesSlide${slideNum}.xml` : null;
        if (notesName && files[notesName]) {
            const notesText = stripXmlToText(new TextDecoder().decode(files[notesName]));
            if (notesText) parts.push(`[Notes] ${notesText}`);
        }
    }
    const text = parts.join("\n\n").trim();
    return {
        text,
        pageCount: slideNames.length,
        warnings: text ? [] : ["PPTX contained no extractable text."],
    };
};

export const callLocalExtract = async ({
    fileName = "",
    contentType = "",
    fileType = "",
    fileBuffer,
} = {}) => {
    if (!fileBuffer || !(fileBuffer instanceof Uint8Array || Buffer.isBuffer(fileBuffer))) {
        throw new Error("Local extract requires a file buffer.");
    }

    const parser = resolveLocalParser({ fileType, contentType, fileName });
    let result;
    if (parser === "docx_local") {
        result = extractDocxText(fileBuffer);
    } else if (parser === "pptx_local") {
        result = extractPptxText(fileBuffer);
    } else if (parser === "plain_text") {
        result = extractPlainText(fileBuffer);
    } else {
        result = await extractPdfText(fileBuffer);
    }

    return {
        text: String(result.text || ""),
        pageCount: result.pageCount,
        backend: "local",
        parser,
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
    };
};
