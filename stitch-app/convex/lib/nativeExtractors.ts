"use node";

/**
 * Native (non-OCR) text extraction for PDF, PPTX, and DOCX files.
 * These run as the first extraction tier — faster and cheaper than Azure OCR.
 * Both functions return empty string on failure so the caller can fall through
 * to Azure Document Intelligence as a second tier.
 */

// ---------------------------------------------------------------------------
// PDF — uses unpdf (serverless-optimised pdf.js wrapper, pure JS/WASM)
// ---------------------------------------------------------------------------

export async function extractTextFromPdfNative(
    fileBuffer: ArrayBuffer
): Promise<string> {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(fileBuffer), {
        verbosity: 0,
    });
    try {
        const { text } = await extractText(pdf, { mergePages: true });
        return typeof text === "string" ? text.trim() : "";
    } finally {
        await pdf.destroy().catch(() => undefined);
    }
}

// ---------------------------------------------------------------------------
// PPTX — ZIP (fflate) + XML regex parse for <a:t> text runs
// ---------------------------------------------------------------------------

const decodeXmlEntities = (s: string) =>
    s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

function extractTextFromPptxXml(xml: string): string {
    const paragraphs: string[] = [];
    const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
        const pContent = pMatch[1];
        const texts: string[] = [];
        const tRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(pContent)) !== null) {
            const decoded = decodeXmlEntities(tMatch[1]);
            if (decoded.trim()) texts.push(decoded);
        }
        if (texts.length > 0) {
            paragraphs.push(texts.join(""));
        }
    }
    return paragraphs.join("\n").trim();
}

export async function extractTextFromPptxNative(
    fileBuffer: ArrayBuffer
): Promise<string> {
    const { unzipSync } = await import("fflate");
    const unzipped = unzipSync(new Uint8Array(fileBuffer));

    const slideEntries: Array<{ index: number; content: Uint8Array }> = [];
    const notesEntries: Array<{ index: number; content: Uint8Array }> = [];

    for (const path of Object.keys(unzipped)) {
        const slideMatch = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        if (slideMatch) {
            slideEntries.push({
                index: parseInt(slideMatch[1], 10),
                content: unzipped[path],
            });
        }
        const notesMatch = path.match(
            /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/
        );
        if (notesMatch) {
            notesEntries.push({
                index: parseInt(notesMatch[1], 10),
                content: unzipped[path],
            });
        }
    }

    slideEntries.sort((a, b) => a.index - b.index);
    notesEntries.sort((a, b) => a.index - b.index);

    const decoder = new TextDecoder("utf-8");
    const allText: string[] = [];

    for (const slide of slideEntries) {
        const xml = decoder.decode(slide.content);
        const slideText = extractTextFromPptxXml(xml);
        if (slideText) {
            allText.push(`--- Slide ${slide.index} ---\n${slideText}`);
        }
    }

    // Speaker notes often contain detailed explanations — include them
    for (const note of notesEntries) {
        const xml = decoder.decode(note.content);
        const noteText = extractTextFromPptxXml(xml);
        if (noteText) {
            allText.push(`[Notes Slide ${note.index}] ${noteText}`);
        }
    }

    return allText.join("\n\n").trim();
}

export type PptxSlideImageCandidate = {
    slideIndex: number;
    contentType: string;
    bytes: ArrayBuffer;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const normalizeZipPath = (value: string) =>
    value
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/{2,}/g, "/");

const resolveZipRelativePath = (basePath: string, targetPath: string) => {
    const baseParts = normalizeZipPath(basePath).split("/");
    baseParts.pop();
    const targetParts = normalizeZipPath(targetPath).split("/");
    const resolved = [...baseParts];
    for (const part of targetParts) {
        if (!part || part === ".") continue;
        if (part === "..") {
            if (resolved.length > 0) resolved.pop();
            continue;
        }
        resolved.push(part);
    }
    return normalizeZipPath(resolved.join("/"));
};

const getImageContentType = (filePath: string) => {
    const lower = normalizeZipPath(filePath).toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".bmp")) return "image/bmp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
    if (lower.endsWith(".webp")) return "image/webp";
    return "";
};

const collectSlideImagePaths = (relsXml: string, slidePath: string): string[] => {
    if (!relsXml) return [];
    const imagePaths: string[] = [];
    const relationshipRegex = /<Relationship\b[^>]*?\bType=(["'])(.*?)\1[^>]*?\bTarget=(["'])(.*?)\3[^>]*\/?>/g;
    let match;
    while ((match = relationshipRegex.exec(relsXml)) !== null) {
        const relType = String(match[2] || "");
        const relTarget = String(match[4] || "");
        if (!/\/image$/i.test(relType) || !relTarget) continue;
        imagePaths.push(resolveZipRelativePath(slidePath, relTarget));
    }
    return imagePaths;
};

export async function extractPptxSlideImageCandidates(
    fileBuffer: ArrayBuffer,
    slideIndexes: number[],
    maxImagesPerSlide = 2
): Promise<PptxSlideImageCandidate[]> {
    if (!Array.isArray(slideIndexes) || slideIndexes.length === 0) return [];

    const { unzipSync } = await import("fflate");
    const unzipped = unzipSync(new Uint8Array(fileBuffer));
    const decoder = new TextDecoder("utf-8");

    const candidates: PptxSlideImageCandidate[] = [];
    const seenPaths = new Set<string>();
    const uniqueSlideIndexes = [...new Set(slideIndexes)]
        .filter((value) => Number.isInteger(value) && value >= 0)
        .sort((a, b) => a - b);

    for (const slideIndex of uniqueSlideIndexes) {
        const slideNumber = slideIndex + 1;
        const slidePath = `ppt/slides/slide${slideNumber}.xml`;
        const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
        const relsBytes = unzipped[relsPath];
        if (!relsBytes) continue;

        const relsXml = decoder.decode(relsBytes);
        const imagePaths = collectSlideImagePaths(relsXml, slidePath);
        let addedForSlide = 0;

        for (const imagePath of imagePaths) {
            if (addedForSlide >= maxImagesPerSlide) break;
            if (seenPaths.has(imagePath)) continue;
            const contentType = getImageContentType(imagePath);
            if (!contentType) continue;

            const imageBytes = unzipped[imagePath];
            if (!imageBytes || imageBytes.byteLength === 0) continue;

            candidates.push({
                slideIndex,
                contentType,
                bytes: toArrayBuffer(imageBytes),
            });
            seenPaths.add(imagePath);
            addedForSlide += 1;
        }
    }

    return candidates;
}

// ---------------------------------------------------------------------------
// DOCX — ZIP (fflate) + XML parse for WordprocessingML text runs
// ---------------------------------------------------------------------------

const DOCX_PAGE_BREAK_TOKEN = "{{DOCX_PAGE_BREAK}}";
const DOCX_LINE_BREAK_TOKEN = "{{DOCX_LINE_BREAK}}";
const DOCX_TAB_TOKEN = "{{DOCX_TAB}}";

const normalizeWordXmlTokens = (xml: string) =>
    String(xml || "")
        .replace(/<w:lastRenderedPageBreak\s*\/>/g, DOCX_PAGE_BREAK_TOKEN)
        .replace(/<w:br\b[^>]*w:type=["']page["'][^>]*\/>/g, DOCX_PAGE_BREAK_TOKEN)
        .replace(/<w:br\b[^>]*\/>/g, DOCX_LINE_BREAK_TOKEN)
        .replace(/<w:tab\s*\/>/g, DOCX_TAB_TOKEN);

const extractWordInlineText = (xmlFragment: string): string => {
    const normalized = normalizeWordXmlTokens(xmlFragment);
    const tokens: string[] = [];
    const tokenRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:instrText(?:\s[^>]*)?>([\s\S]*?)<\/w:instrText>|(\{\{DOCX_PAGE_BREAK\}\}|\{\{DOCX_LINE_BREAK\}\}|\{\{DOCX_TAB\}\})/g;

    let match;
    while ((match = tokenRegex.exec(normalized)) !== null) {
        const textRun = match[1] ?? match[2];
        const marker = match[3];

        if (typeof textRun === "string") {
            const decoded = decodeXmlEntities(textRun);
            if (decoded.length > 0) tokens.push(decoded);
            continue;
        }

        if (marker === DOCX_PAGE_BREAK_TOKEN) {
            tokens.push("\f");
        } else if (marker === DOCX_LINE_BREAK_TOKEN) {
            tokens.push("\n");
        } else if (marker === DOCX_TAB_TOKEN) {
            tokens.push("\t");
        }
    }

    const merged = tokens.join("");
    return merged
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const extractWordParagraph = (paragraphXml: string): string => {
    const text = extractWordInlineText(paragraphXml);
    if (!text && paragraphXml.includes(DOCX_PAGE_BREAK_TOKEN)) {
        return "\f";
    }
    return text;
};

const extractWordTable = (tableXml: string): string => {
    const rows: string[][] = [];
    const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
        const rowXml = rowMatch[1];
        const cells: string[] = [];
        const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
            const cellText = extractWordInlineText(cellMatch[1])
                .replace(/\n+/g, " ")
                .replace(/\s{2,}/g, " ")
                .trim();
            cells.push(cellText || "-");
        }
        if (cells.length > 0) rows.push(cells);
    }

    if (rows.length === 0) return "";
    const tableLines = rows.map((row) => `| ${row.join(" | ")} |`);
    if (tableLines.length > 1) {
        const separator = `| ${rows[0].map(() => "---").join(" | ")} |`;
        tableLines.splice(1, 0, separator);
    }
    return `[Table]\n${tableLines.join("\n")}`;
};

const extractWordprocessingDocumentXml = (xml: string): string => {
    const normalized = normalizeWordXmlTokens(xml);
    const blocks: string[] = [];
    const blockRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;

    let blockMatch;
    while ((blockMatch = blockRegex.exec(normalized)) !== null) {
        const block = blockMatch[0];
        if (block.startsWith("<w:tbl")) {
            const tableText = extractWordTable(block);
            if (tableText) blocks.push(tableText);
            continue;
        }
        const paragraphText = extractWordParagraph(block);
        if (paragraphText) blocks.push(paragraphText);
    }

    return blocks
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const sortWordPartPaths = (paths: string[], regex: RegExp) =>
    [...paths]
        .map((value) => ({ value, match: value.match(regex) }))
        .filter((entry) => Boolean(entry.match))
        .sort((a, b) => Number(a.match?.[1] || 0) - Number(b.match?.[1] || 0))
        .map((entry) => entry.value);

export async function extractTextFromDocxNative(
    fileBuffer: ArrayBuffer
): Promise<string> {
    const { unzipSync } = await import("fflate");
    const unzipped = unzipSync(new Uint8Array(fileBuffer));
    const decoder = new TextDecoder("utf-8");

    const readPart = (partPath: string) => {
        const bytes = unzipped[partPath];
        if (!bytes) return "";
        return decoder.decode(bytes);
    };

    const sections: string[] = [];

    const documentXml = readPart("word/document.xml");
    if (documentXml) {
        const bodyText = extractWordprocessingDocumentXml(documentXml);
        if (bodyText) sections.push(bodyText);
    }

    const partPaths = Object.keys(unzipped);

    const headerPaths = sortWordPartPaths(partPaths, /^word\/header(\d+)\.xml$/);
    for (const headerPath of headerPaths) {
        const headerText = extractWordprocessingDocumentXml(readPart(headerPath));
        if (headerText) sections.push(`[Header]\n${headerText}`);
    }

    const footerPaths = sortWordPartPaths(partPaths, /^word\/footer(\d+)\.xml$/);
    for (const footerPath of footerPaths) {
        const footerText = extractWordprocessingDocumentXml(readPart(footerPath));
        if (footerText) sections.push(`[Footer]\n${footerText}`);
    }

    const footnotesXml = readPart("word/footnotes.xml");
    if (footnotesXml) {
        const footnotesText = extractWordprocessingDocumentXml(footnotesXml);
        if (footnotesText) sections.push(`[Footnotes]\n${footnotesText}`);
    }

    const endnotesXml = readPart("word/endnotes.xml");
    if (endnotesXml) {
        const endnotesText = extractWordprocessingDocumentXml(endnotesXml);
        if (endnotesText) sections.push(`[Endnotes]\n${endnotesText}`);
    }

    return sections
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
