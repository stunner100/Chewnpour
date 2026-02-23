"use node";

/**
 * Native (non-OCR) text extraction for PDF and PPTX files.
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
