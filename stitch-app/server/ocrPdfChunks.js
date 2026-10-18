import { PDFDocument } from "pdf-lib";

// OCR.space's free tier takes at most 1MB and 3 PDF pages per request, so a
// scanned past paper or lecture PDF is split into page groups that fit,
// OCR'd one group at a time, and the text joined in page order.
export const DEFAULT_MAX_PAGES_PER_REQUEST = 3;
export const DEFAULT_MAX_TOTAL_PAGES = 30;

/**
 * Groups pages, in order, so each group stays under both limits. A page
 * that is too big on its own is reported in `skipped` instead.
 * @param pageSizes byte size of each page saved as its own PDF
 */
export const planPageGroups = (pageSizes, { maxBytes, maxPages }) => {
    const groups = [];
    const skipped = [];
    let current = [];
    let currentBytes = 0;
    pageSizes.forEach((size, index) => {
        if (size > maxBytes) {
            skipped.push(index);
            return;
        }
        if (current.length >= maxPages || currentBytes + size > maxBytes) {
            if (current.length) groups.push(current);
            current = [];
            currentBytes = 0;
        }
        current.push(index);
        currentBytes += size;
    });
    if (current.length) groups.push(current);
    return { groups, skipped };
};

const savePages = async (source, pageIndexes) => {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(source, pageIndexes);
    for (const page of pages) doc.addPage(page);
    return Buffer.from(await doc.save({ useObjectStreams: true }));
};

/**
 * Splits a PDF into OCR-sized chunks.
 * @returns {{ chunks: [{ pages: number[], buffer: Buffer }], pageCount, skippedPages: number[], truncated: boolean }}
 */
export const splitPdfForOcr = async (
    fileBuffer,
    { maxBytes, maxPages = DEFAULT_MAX_PAGES_PER_REQUEST, maxTotalPages = DEFAULT_MAX_TOTAL_PAGES } = {},
) => {
    const source = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const pageCount = source.getPageCount();
    const usable = Math.min(pageCount, maxTotalPages);

    const pageSizes = [];
    for (let index = 0; index < usable; index += 1) {
        pageSizes.push((await savePages(source, [index])).length);
    }
    const { groups, skipped } = planPageGroups(pageSizes, { maxBytes, maxPages });

    const chunks = [];
    for (const pages of groups) {
        const buffer = await savePages(source, pages);
        if (buffer.length <= maxBytes || pages.length === 1) {
            chunks.push({ pages, buffer });
            continue;
        }
        // Shared resources made the group bigger than its pages' sum; fall back to one page each.
        for (const page of pages) {
            chunks.push({ pages: [page], buffer: await savePages(source, [page]) });
        }
    }
    return { chunks, pageCount, skippedPages: skipped, truncated: pageCount > usable };
};
