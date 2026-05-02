"use node";

import { Buffer } from "node:buffer";
import { PDFDocument } from "pdf-lib";
import {
    extractTextFromDocxNative,
    extractPptxSlideImageCandidates,
    extractTextFromPdfNative,
    extractTextFromPptxNative,
} from "./nativeExtractors";
import {
    callDataLabExtract,
    isDataLabEnabled,
    type DataLabExtractResponse,
} from "./datalabClient";
import {
    callDoclingExtract,
    type DoclingBlock,
    type DoclingExtractResponse,
    type DoclingParserId as DoclingClientParserId,
    isDoclingEnabled,
} from "./doclingClient";
import {
    callLlamaParseExtract,
    isLlamaParseEnabled,
    type LlamaParseExtractResponse,
} from "./llamaParseClient";

export type ExtractionBackendId = "datalab" | "azure" | "docling" | "llamaparse";
export type ExtractionParserId =
    | "datalab"
    | "azure_layout_read"
    | "enhanced_pdf"
    | "paddleocr_vl"
    | "docx_structured"
    | "image_ocr"
    | "llamaparse";
export type DoclingParserId = Exclude<ExtractionParserId, "datalab" | "azure_layout_read" | "llamaparse">;
export type ExtractionFallbackRecommendation =
    | {
        backend: "datalab";
        parser: "datalab";
        reason: string;
    }
    | {
        backend: "docling";
        parser: DoclingParserId;
        reason: string;
    }
    | {
        backend: "llamaparse";
        parser: "llamaparse";
        reason: string;
    };

export type ExtractionPassTrace = {
    pass: string;
    status: "ok" | "skipped" | "error";
    latencyMs: number;
    chars: number;
    pageCount: number;
    error?: string;
};

type ExtractionPage = {
    index: number;
    text: string;
    source: "native" | "azure_layout" | "azure_read" | "datalab" | "docling" | "llamaparse" | "none";
    chars: number;
    words: number;
    lexicalRatio: number;
    tableCount: number;
    formulaCount: number;
    score: number;
};

type CandidatePage = {
    index: number;
    text: string;
    source: "native" | "azure_layout" | "azure_read" | "datalab" | "docling" | "llamaparse";
    tableCount: number;
    formulaCount: number;
};

type PassResult = {
    text: string;
    pages: CandidatePage[];
    pageCount: number;
    tableCount: number;
    formulaCount: number;
};

type ExtractionArtifactMetadata = {
    doclingBlocks?: DoclingBlock[];
    [key: string]: unknown;
};

type PipelineMetrics = {
    fileType: string;
    qualityScore: number;
    coverage: number;
    strictPass: boolean;
    provisional: boolean;
    pagePresenceRatio: number;
    weakPageRatio: number;
    tableRecoveryRatio: number;
    formulaMarkerLoss: number;
    expectedPageCount: number;
    scannedLikely: boolean;
    requiredPagePresence: number;
    weakPageThreshold: number;
};

export type DocumentExtractionResult = {
    backend: ExtractionBackendId;
    parser: ExtractionParserId;
    text: string;
    qualityScore: number;
    coverage: number;
    strictPass: boolean;
    provisional: boolean;
    warnings: string[];
    pageCount: number;
    providerTrace: ExtractionPassTrace[];
    fallbackRecommendation: ExtractionFallbackRecommendation | null;
    artifact: {
        version: string;
        backend: ExtractionBackendId;
        parser: ExtractionParserId;
        fileType: string;
        expectedPageCount: number;
        pages: ExtractionPage[];
        metrics: PipelineMetrics;
        warnings: string[];
        metadata?: Record<string, unknown>;
        generatedAt: number;
    };
};

export type RunDocumentExtractionArgs = {
    uploadId: string;
    fileName: string;
    fileType: string;
    fileBuffer: ArrayBuffer;
    mode: "foreground" | "background";
    maxDurationMs: number;
    backend?: ExtractionBackendId;
    parser?: ExtractionParserId | null;
};

const EXTRACTION_VERSION = "v2";
const STRICT_QUALITY_THRESHOLD = 0.93;
const STRICT_PAGE_PRESENCE_THRESHOLD = 0.98;
const STRICT_PAGE_PRESENCE_SCANNED_THRESHOLD = 0.95;
const STRICT_WEAK_PAGE_RATIO_THRESHOLD = 0.05;
const STRICT_PAGE_PRESENCE_PPTX_THRESHOLD = 0.9;
const STRICT_WEAK_PAGE_RATIO_PPTX_THRESHOLD = 0.2;
const STRICT_TABLE_RECOVERY_THRESHOLD = 0.9;
const STRICT_FORMULA_LOSS_THRESHOLD = 0.1;

const AZURE_DOCINTEL_ENDPOINT = String(process.env.AZURE_DOCINTEL_ENDPOINT || "").trim();
const AZURE_DOCINTEL_KEY = String(process.env.AZURE_DOCINTEL_KEY || "").trim();
const AZURE_DOCINTEL_API_VERSION = String(process.env.AZURE_DOCINTEL_API_VERSION || "2023-07-31").trim();
const AZURE_DOCINTEL_MAX_DIRECT_BYTES = Number(process.env.AZURE_DOCINTEL_MAX_DIRECT_BYTES || 22 * 1024 * 1024);
const PDF_BATCH_PAGE_SIZE = Number(process.env.EXTRACTION_PDF_BATCH_PAGE_SIZE || 4);
const PDF_BATCH_MAX_PAGES_FOREGROUND = Number(process.env.EXTRACTION_PDF_BATCH_MAX_PAGES_FOREGROUND || 30);
const PDF_BATCH_MAX_PAGES_BACKGROUND = Number(process.env.EXTRACTION_PDF_BATCH_MAX_PAGES_BACKGROUND || 140);
const PPTX_LOW_TEXT_WORDS_THRESHOLD = Number(process.env.EXTRACTION_PPTX_LOW_TEXT_WORDS_THRESHOLD || 14);
const PPTX_LOW_TEXT_CHARS_THRESHOLD = Number(process.env.EXTRACTION_PPTX_LOW_TEXT_CHARS_THRESHOLD || 100);
const PPTX_MAX_IMAGES_PER_SLIDE = Number(process.env.EXTRACTION_PPTX_MAX_IMAGES_PER_SLIDE || 2);
const PPTX_MAX_LOW_TEXT_SLIDES_FOREGROUND = Number(process.env.EXTRACTION_PPTX_MAX_LOW_TEXT_SLIDES_FOREGROUND || 60);
const PPTX_MAX_LOW_TEXT_SLIDES_BACKGROUND = Number(process.env.EXTRACTION_PPTX_MAX_LOW_TEXT_SLIDES_BACKGROUND || 120);
const AZURE_429_MAX_RETRIES = Number(process.env.AZURE_DOCINTEL_429_MAX_RETRIES || 8);
const FOREGROUND_AZURE_PASS_TIMEOUT_MS = Number(process.env.EXTRACTION_FOREGROUND_AZURE_PASS_TIMEOUT_MS || 90000);

let azureAnalyzeQueue = Promise.resolve();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const cloneArrayBuffer = (value: ArrayBuffer): ArrayBuffer => value.slice(0);
const toArrayBuffer = (value: Uint8Array): ArrayBuffer =>
    value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);

const toSafePositiveInt = (value: number, fallback: number) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(1, Math.floor(value));
};

const isInvalidContentLengthError = (value: string) =>
    /InvalidContentLength/i.test(String(value || ""));

const getRetryDelayMs = (response: any, errorText: string, attempt: number) => {
    const retryAfterSeconds = Number(response.headers.get("retry-after") || "");
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : null;
    const bodyDelayMatch = String(errorText || "").match(/retry after (\d+) second/i);
    const bodyDelayMs = bodyDelayMatch ? Number(bodyDelayMatch[1]) * 1000 : null;
    const baseDelay = retryAfterMs || bodyDelayMs || 1500;
    const backoff = baseDelay * Math.max(1, attempt + 1);
    const jitter = Math.floor(Math.random() * 300);
    return Math.max(1000, Math.min(12000, backoff + jitter));
};

const runWithAzureQueue = async <T>(run: () => Promise<T>): Promise<T> => {
    const previous = azureAnalyzeQueue;
    let release = () => undefined;
    azureAnalyzeQueue = new Promise<void>((resolve) => {
        release = resolve;
    });
    await previous;
    try {
        return await run();
    } finally {
        release();
    }
};

const summarizeExtractionError = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

const countWords = (value: string) =>
    String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

const sanitizeText = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const lexicalRatio = (value: string) => {
    const text = String(value || "");
    if (!text) return 0;
    const letterLike = (text.match(/[A-Za-z0-9]/g) || []).length;
    return clamp(letterLike / Math.max(text.length, 1), 0, 1);
};

const PPTX_SLIDE_SEPARATOR_PATTERN = /(?:^|\n\n)--- Slide\s+\d+\s+---\s*/g;

const parsePptxSlidesFromNative = (value: string): CandidatePage[] => {
    const text = sanitizeText(value);
    if (!text) return [];
    const split = text
        .split(PPTX_SLIDE_SEPARATOR_PATTERN)
        .map((entry) => sanitizeText(entry))
        .filter(Boolean);
    if (split.length <= 1) {
        return [{ index: 0, text: split[0] || text, source: "native", tableCount: 0, formulaCount: 0 }];
    }
    return split.map((pageText, index) => ({
        index,
        text: sanitizeText(pageText),
        source: "native",
        tableCount: 0,
        formulaCount: 0,
    }));
};

const parsePdfPagesFromNative = (value: string): CandidatePage[] => {
    const text = sanitizeText(value);
    if (!text) return [];
    const split = text.split(/\f+/g).map((entry) => sanitizeText(entry)).filter(Boolean);
    if (split.length === 0) {
        return [{ index: 0, text, source: "native", tableCount: 0, formulaCount: 0 }];
    }
    return split.map((pageText, index) => ({
        index,
        text: pageText,
        source: "native",
        tableCount: 0,
        formulaCount: 0,
    }));
};

const splitTextIntoSyntheticPages = (
    value: string,
    source: "native" | "azure_layout" | "azure_read" | "datalab" | "llamaparse",
    targetCharsPerPage = 2600
): CandidatePage[] => {
    const text = sanitizeText(value);
    if (!text) return [];

    const hardSplit = text
        .split(/\f+/g)
        .map((entry) => sanitizeText(entry))
        .filter(Boolean);

    if (hardSplit.length > 1) {
        return hardSplit.map((pageText, index) => ({
            index,
            text: pageText,
            source,
            tableCount: 0,
            formulaCount: 0,
        }));
    }

    const paragraphs = text
        .split(/\n{2,}/g)
        .map((entry) => sanitizeText(entry))
        .filter(Boolean);

    if (paragraphs.length === 0) {
        return [{ index: 0, text, source, tableCount: 0, formulaCount: 0 }];
    }

    const pages: CandidatePage[] = [];
    let current = "";
    for (const paragraph of paragraphs) {
        if (!current) {
            current = paragraph;
            continue;
        }

        const candidate = `${current}\n\n${paragraph}`;
        if (candidate.length <= targetCharsPerPage) {
            current = candidate;
            continue;
        }

        pages.push({
            index: pages.length,
            text: sanitizeText(current),
            source,
            tableCount: 0,
            formulaCount: 0,
        });
        current = paragraph;
    }

    if (current) {
        pages.push({
            index: pages.length,
            text: sanitizeText(current),
            source,
            tableCount: 0,
            formulaCount: 0,
        });
    }

    return pages.length > 0
        ? pages
        : [{ index: 0, text, source, tableCount: 0, formulaCount: 0 }];
};

const parseDocxPagesFromNative = (value: string): CandidatePage[] =>
    splitTextIntoSyntheticPages(value, "native");

const runNativePass = async (fileType: string, fileBuffer: ArrayBuffer): Promise<PassResult> => {
    if (fileType === "pdf") {
        const text = sanitizeText(await extractTextFromPdfNative(fileBuffer));
        const pages = parsePdfPagesFromNative(text);
        return {
            text,
            pages,
            pageCount: pages.length,
            tableCount: 0,
            formulaCount: 0,
        };
    }

    if (fileType === "pptx") {
        const text = sanitizeText(await extractTextFromPptxNative(fileBuffer));
        const pages = parsePptxSlidesFromNative(text);
        return {
            text,
            pages,
            pageCount: pages.length,
            tableCount: 0,
            formulaCount: 0,
        };
    }

    if (fileType === "docx") {
        const text = sanitizeText(await extractTextFromDocxNative(fileBuffer));
        const pages = parseDocxPagesFromNative(text);
        return {
            text,
            pages,
            pageCount: pages.length,
            tableCount: (text.match(/\[Table\]/g) || []).length,
            formulaCount: 0,
        };
    }

    return {
        text: "",
        pages: [],
        pageCount: 0,
        tableCount: 0,
        formulaCount: 0,
    };
};

const normalizeUploadFileType = (fileType: string, fileName?: string) => {
    const rawType = String(fileType || "").trim().toLowerCase().split(";")[0];
    const rawName = String(fileName || "").trim().toLowerCase();
    const candidate = rawType || rawName;

    if (candidate === "pdf" || candidate.endsWith(".pdf") || candidate.includes("application/pdf")) return "pdf";
    if (
        candidate === "docx"
        || candidate.endsWith(".docx")
        || candidate.includes("wordprocessingml.document")
    ) return "docx";
    if (
        candidate === "pptx"
        || candidate.endsWith(".pptx")
        || candidate.includes("presentationml.presentation")
    ) return "pptx";
    if (candidate === "png" || candidate.endsWith(".png") || candidate.includes("image/png")) return "png";
    if (
        candidate === "jpg"
        || candidate === "jpeg"
        || candidate.endsWith(".jpg")
        || candidate.endsWith(".jpeg")
        || candidate.includes("image/jpeg")
    ) return "jpg";
    if (candidate === "webp" || candidate.endsWith(".webp") || candidate.includes("image/webp")) return "webp";
    return rawType || rawName;
};

const mapUploadTypeToContentType = (fileType: string) => {
    const normalizedFileType = normalizeUploadFileType(fileType);
    if (normalizedFileType === "pdf") return "application/pdf";
    if (normalizedFileType === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (normalizedFileType === "png") return "image/png";
    if (normalizedFileType === "jpg" || normalizedFileType === "jpeg") return "image/jpeg";
    if (normalizedFileType === "webp") return "image/webp";
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
};

const formatAzureTable = (table: any) => {
    const cells = table?.cells || [];
    if (cells.length === 0) return "";

    const maxRow = Math.max(0, ...cells.map((c: any) => Number(c.rowIndex ?? 0)));
    const maxCol = Math.max(0, ...cells.map((c: any) => Number(c.columnIndex ?? 0)));
    const grid: string[][] = Array.from({ length: maxRow + 1 }, () =>
        Array(maxCol + 1).fill("-")
    );

    for (const cell of cells) {
        const r = Number(cell.rowIndex ?? 0);
        const c = Number(cell.columnIndex ?? 0);
        const text = String(cell.content || "").replace(/\|/g, "/").replace(/\n/g, " ").trim();
        grid[r][c] = text || "-";
    }

    const tableLines = grid.map((row) => "| " + row.join(" | ") + " |");
    if (tableLines.length > 1) {
        const sep = "| " + grid[0].map(() => "---").join(" | ") + " |";
        tableLines.splice(1, 0, sep);
    }
    return tableLines.join("\n");
};

const extractPagesFromAzureResult = (result: any, source: "azure_layout" | "azure_read"): PassResult => {
    const pages = (result?.analyzeResult?.pages || []) as any[];
    const tables = (result?.analyzeResult?.tables || []) as any[];
    const formulas = (result?.analyzeResult?.formulas || []) as any[];

    const tableCountByPage = new Map<number, number>();
    for (const table of tables) {
        const regions = Array.isArray(table?.boundingRegions) ? table.boundingRegions : [];
        const pageNum = Number(regions[0]?.pageNumber || 0);
        if (pageNum > 0) {
            tableCountByPage.set(pageNum - 1, (tableCountByPage.get(pageNum - 1) || 0) + 1);
        }
    }

    const formulaCountByPage = new Map<number, number>();
    for (const formula of formulas) {
        const regions = Array.isArray(formula?.boundingRegions) ? formula.boundingRegions : [];
        const pageNum = Number(regions[0]?.pageNumber || 0);
        if (pageNum > 0) {
            formulaCountByPage.set(pageNum - 1, (formulaCountByPage.get(pageNum - 1) || 0) + 1);
        }
    }

    const pageEntries: CandidatePage[] = pages.map((page, index) => {
        const lineText = (page?.lines || [])
            .map((line: any) => String(line?.content || "").trim())
            .filter(Boolean)
            .join("\n");

        const pageTables = tables
            .filter((table: any) => {
                const regions = Array.isArray(table?.boundingRegions) ? table.boundingRegions : [];
                return Number(regions[0]?.pageNumber || 0) - 1 === index;
            })
            .map((table: any) => formatAzureTable(table))
            .filter(Boolean)
            .map((value: string) => `\n[Table]\n${value}`)
            .join("\n");

        const pageFormulas = formulas
            .filter((formula: any) => {
                const regions = Array.isArray(formula?.boundingRegions) ? formula.boundingRegions : [];
                return Number(regions[0]?.pageNumber || 0) - 1 === index;
            })
            .map((formula: any) => String(formula?.value || formula?.content || "").trim())
            .filter(Boolean)
            .map((value: string) => `[Formula] ${value}`)
            .join("\n");

        const text = sanitizeText([lineText, pageTables, pageFormulas].filter(Boolean).join("\n\n"));
        return {
            index,
            text,
            source,
            tableCount: tableCountByPage.get(index) || 0,
            formulaCount: formulaCountByPage.get(index) || 0,
        };
    });

    const fallbackContent = sanitizeText(String(result?.analyzeResult?.content || ""));
    const fallbackPages = pageEntries.length > 0 || !fallbackContent
        ? []
        : splitTextIntoSyntheticPages(fallbackContent, source);
    const mergedPages = pageEntries.length > 0 ? pageEntries : fallbackPages;
    const text = mergedPages.length > 0
        ? sanitizeText(mergedPages.map((entry) => entry.text).filter(Boolean).join("\n\n\f\n\n"))
        : fallbackContent;

    return {
        text,
        pages: mergedPages,
        pageCount: mergedPages.length,
        tableCount: tables.length,
        formulaCount: formulas.length,
    };
};

const emptyPassResult = (): PassResult => ({
    text: "",
    pages: [],
    pageCount: 0,
    tableCount: 0,
    formulaCount: 0,
});

type AzureModel = "prebuilt-layout" | "prebuilt-read";

type AzureAnalyzeDirectArgs = {
    fileBuffer: ArrayBuffer;
    contentType: string;
    model: AzureModel;
    startedAt: number;
    maxDurationMs: number;
    pollAttempts: number;
};

const callAzureAnalyzeDirect = async (args: AzureAnalyzeDirectArgs): Promise<PassResult> => {
    if (!AZURE_DOCINTEL_ENDPOINT || !AZURE_DOCINTEL_KEY) {
        return emptyPassResult();
    }

    return await runWithAzureQueue(async () => {
        const endpoint = AZURE_DOCINTEL_ENDPOINT.replace(/\/+$/, "");
        const url = `${endpoint}/formrecognizer/documentModels/${args.model}:analyze?api-version=${AZURE_DOCINTEL_API_VERSION}`;
        let analyzeResponse: any = null;
        let analyzeErrText = "";
        for (let analyzeAttempt = 0; analyzeAttempt <= AZURE_429_MAX_RETRIES; analyzeAttempt += 1) {
            analyzeResponse = await fetch(url, {
                method: "POST",
                headers: {
                    "Ocp-Apim-Subscription-Key": AZURE_DOCINTEL_KEY,
                    "Content-Type": args.contentType,
                },
                body: Buffer.from(args.fileBuffer),
            });

            if (analyzeResponse.status === 429) {
                analyzeErrText = await analyzeResponse.text();
                if (analyzeAttempt < AZURE_429_MAX_RETRIES) {
                    const retryMs = getRetryDelayMs(analyzeResponse, analyzeErrText, analyzeAttempt);
                    await sleep(retryMs);
                    continue;
                }
            }
            break;
        }

        if (!analyzeResponse || analyzeResponse.status !== 202) {
            const errText = analyzeErrText || (analyzeResponse ? await analyzeResponse.text() : "unknown");
            throw new Error(`Azure ${args.model} analyze error: ${analyzeResponse?.status || "unknown"} - ${errText}`);
        }

        const operationLocation = analyzeResponse.headers.get("operation-location");
        if (!operationLocation) {
            throw new Error(`Azure ${args.model} analyze error: missing operation-location`);
        }

        let rateLimitRetries = 0;
        const maxPollAttempts = toSafePositiveInt(args.pollAttempts, 30);
        for (let i = 0; i < maxPollAttempts; i += 1) {
            if (Date.now() - args.startedAt > args.maxDurationMs) {
                throw new Error(`Azure ${args.model} timed out by extraction budget`);
            }

            await sleep(2000);
            const pollResponse = await fetch(operationLocation, {
                headers: {
                    "Ocp-Apim-Subscription-Key": AZURE_DOCINTEL_KEY,
                },
            });

            if (!pollResponse.ok) {
                const errText = await pollResponse.text();
                if (pollResponse.status === 429 && rateLimitRetries < AZURE_429_MAX_RETRIES) {
                    const waitMs = getRetryDelayMs(pollResponse, errText, rateLimitRetries);
                    rateLimitRetries += 1;
                    await sleep(waitMs);
                    continue;
                }
                throw new Error(`Azure ${args.model} polling error: ${pollResponse.status} - ${errText}`);
            }

            const data = await pollResponse.json();
            const status = String(data?.status || "").toLowerCase();
            if (status === "succeeded") {
                return extractPagesFromAzureResult(
                    data,
                    args.model === "prebuilt-layout" ? "azure_layout" : "azure_read"
                );
            }

            if (status === "failed") {
                throw new Error(`Azure ${args.model} failed`);
            }
        }

        throw new Error(`Azure ${args.model} timed out`);
    });
};

const runPdfBatchedOcrPass = async (args: {
    fileBuffer: ArrayBuffer;
    model: AzureModel;
    mode: "foreground" | "background";
    startedAt: number;
    maxDurationMs: number;
    pollAttempts: number;
}): Promise<PassResult> => {
    const batchSize = toSafePositiveInt(PDF_BATCH_PAGE_SIZE, 4);
    const maxPagesForMode = args.mode === "background"
        ? toSafePositiveInt(PDF_BATCH_MAX_PAGES_BACKGROUND, 140)
        : toSafePositiveInt(PDF_BATCH_MAX_PAGES_FOREGROUND, 80);

    const source = args.model === "prebuilt-layout" ? "azure_layout" : "azure_read";
    const passTimeoutMs = args.mode === "foreground"
        ? Math.min(args.maxDurationMs, toSafePositiveInt(FOREGROUND_AZURE_PASS_TIMEOUT_MS, 90000))
        : args.maxDurationMs;
    const passDeadline = args.startedAt + passTimeoutMs;
    const sourcePdf = await PDFDocument.load(cloneArrayBuffer(args.fileBuffer), {
        ignoreEncryption: true,
    });

    const totalPages = sourcePdf.getPageCount();
    const pagesToProcess = Math.min(totalPages, maxPagesForMode);
    if (pagesToProcess === 0) return emptyPassResult();

    const pageTextByIndex = new Map<number, CandidatePage>();
    let recoveredTables = 0;
    let recoveredFormulas = 0;

    for (let start = 0; start < pagesToProcess; start += batchSize) {
        if (Date.now() > passDeadline) {
            throw new Error(`Azure ${args.model} timed out by extraction budget`);
        }

        const endExclusive = Math.min(pagesToProcess, start + batchSize);
        const pageIndexes = Array.from(
            { length: endExclusive - start },
            (_, offset) => start + offset
        );

        const chunkDoc = await PDFDocument.create();
        const copiedPages = await chunkDoc.copyPages(sourcePdf, pageIndexes);
        for (const copiedPage of copiedPages) {
            chunkDoc.addPage(copiedPage);
        }

        const chunkBytes = await chunkDoc.save({
            useObjectStreams: false,
            updateFieldAppearances: false,
        });

        const chunkResult = await callAzureAnalyzeDirect({
            fileBuffer: toArrayBuffer(chunkBytes),
            contentType: "application/pdf",
            model: args.model,
            startedAt: args.startedAt,
            maxDurationMs: passTimeoutMs,
            pollAttempts: Math.max(10, Math.floor(args.pollAttempts / 2)),
        });

        const chunkPages = chunkResult.pages.length > 0
            ? chunkResult.pages
            : splitTextIntoSyntheticPages(
                chunkResult.text,
                args.model === "prebuilt-layout" ? "azure_layout" : "azure_read"
            );

        for (let offset = 0; offset < pageIndexes.length; offset += 1) {
            const absoluteIndex = pageIndexes[offset];
            const extractedPage = chunkPages[offset];
            if (!extractedPage) continue;

            const text = sanitizeText(extractedPage.text);
            if (!text) continue;

            pageTextByIndex.set(absoluteIndex, {
                index: absoluteIndex,
                text,
                source,
                tableCount: Number(extractedPage.tableCount || 0),
                formulaCount: Number(extractedPage.formulaCount || 0),
            });
            recoveredTables += Number(extractedPage.tableCount || 0);
            recoveredFormulas += Number(extractedPage.formulaCount || 0);
        }
    }

    const pages = Array.from({ length: totalPages }, (_, index) => pageTextByIndex.get(index) || {
        index,
        text: "",
        source,
        tableCount: 0,
        formulaCount: 0,
    });

    return {
        text: sanitizeText(pages.map((entry) => entry.text).filter(Boolean).join("\n\n\f\n\n")),
        pages,
        pageCount: totalPages,
        tableCount: recoveredTables,
        formulaCount: recoveredFormulas,
    };
};

const runPptxLowTextImageOcrPass = async (args: {
    fileBuffer: ArrayBuffer;
    model: AzureModel;
    mode: "foreground" | "background";
    startedAt: number;
    maxDurationMs: number;
    pollAttempts: number;
    nativePages: CandidatePage[];
}): Promise<PassResult> => {
    if (args.model === "prebuilt-layout") {
        return emptyPassResult();
    }

    const lowTextSlideIndexes = args.nativePages
        .filter((page) =>
            countWords(page.text) < toSafePositiveInt(PPTX_LOW_TEXT_WORDS_THRESHOLD, 14)
            || page.text.length < toSafePositiveInt(PPTX_LOW_TEXT_CHARS_THRESHOLD, 100)
        )
        .map((page) => page.index);

    if (lowTextSlideIndexes.length === 0) {
        return emptyPassResult();
    }

    const maxSlides = args.mode === "background"
        ? toSafePositiveInt(PPTX_MAX_LOW_TEXT_SLIDES_BACKGROUND, 120)
        : toSafePositiveInt(PPTX_MAX_LOW_TEXT_SLIDES_FOREGROUND, 60);
    const passTimeoutMs = args.mode === "foreground"
        ? Math.min(args.maxDurationMs, toSafePositiveInt(FOREGROUND_AZURE_PASS_TIMEOUT_MS, 90000))
        : args.maxDurationMs;
    const passDeadline = args.startedAt + passTimeoutMs;
    const selectedSlideIndexes = lowTextSlideIndexes.slice(0, maxSlides);

    const candidates = await extractPptxSlideImageCandidates(
        cloneArrayBuffer(args.fileBuffer),
        selectedSlideIndexes,
        toSafePositiveInt(PPTX_MAX_IMAGES_PER_SLIDE, 2)
    );

    if (candidates.length === 0) {
        return emptyPassResult();
    }

    const recoveredBySlide = new Map<number, CandidatePage>();
    for (const candidate of candidates) {
        if (Date.now() > passDeadline) {
            throw new Error(`Azure ${args.model} timed out by extraction budget`);
        }

        let result: PassResult;
        try {
            result = await callAzureAnalyzeDirect({
                fileBuffer: cloneArrayBuffer(candidate.bytes),
                contentType: candidate.contentType,
                model: args.model,
                startedAt: args.startedAt,
                maxDurationMs: passTimeoutMs,
                pollAttempts: Math.max(8, Math.floor(args.pollAttempts / 2)),
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isInvalidContentLengthError(message)) {
                continue;
            }
            throw error;
        }
        const recoveredText = sanitizeText(
            result.pages.length > 0
                ? result.pages.map((entry) => entry.text).filter(Boolean).join("\n")
                : String(result.text || "")
        );
        if (!recoveredText) continue;

        const existing = recoveredBySlide.get(candidate.slideIndex);
        if (!existing || recoveredText.length > existing.text.length) {
            recoveredBySlide.set(candidate.slideIndex, {
                index: candidate.slideIndex,
                text: recoveredText,
                source: "azure_read",
                tableCount: Number(result.tableCount || 0),
                formulaCount: Number(result.formulaCount || 0),
            });
        }
    }

    const pages = [...recoveredBySlide.values()].sort((a, b) => a.index - b.index);
    return {
        text: sanitizeText(pages.map((entry) => entry.text).filter(Boolean).join("\n\n\f\n\n")),
        pages,
        pageCount: Math.max(args.nativePages.length, pages.length),
        tableCount: pages.reduce((sum, page) => sum + Number(page.tableCount || 0), 0),
        formulaCount: pages.reduce((sum, page) => sum + Number(page.formulaCount || 0), 0),
    };
};

const runAzurePass = async (args: {
    fileBuffer: ArrayBuffer;
    contentType: string;
    fileType: string;
    model: AzureModel;
    mode: "foreground" | "background";
    startedAt: number;
    maxDurationMs: number;
    pollAttempts: number;
    nativePages: CandidatePage[];
}): Promise<PassResult> => {
    const fileBytes = Number(args.fileBuffer.byteLength || 0);
    const isOversized = fileBytes > toSafePositiveInt(AZURE_DOCINTEL_MAX_DIRECT_BYTES, 22 * 1024 * 1024);

    if (args.fileType === "pdf" && isOversized) {
        return await runPdfBatchedOcrPass({
            fileBuffer: cloneArrayBuffer(args.fileBuffer),
            model: args.model,
            mode: args.mode,
            startedAt: args.startedAt,
            maxDurationMs: args.maxDurationMs,
            pollAttempts: args.pollAttempts,
        });
    }

    if (args.fileType === "pptx" && isOversized) {
        return await runPptxLowTextImageOcrPass({
            fileBuffer: cloneArrayBuffer(args.fileBuffer),
            model: args.model,
            mode: args.mode,
            startedAt: args.startedAt,
            maxDurationMs: args.maxDurationMs,
            pollAttempts: args.pollAttempts,
            nativePages: args.nativePages,
        });
    }

    try {
        return await callAzureAnalyzeDirect({
            fileBuffer: cloneArrayBuffer(args.fileBuffer),
            contentType: args.contentType,
            model: args.model,
            startedAt: args.startedAt,
            maxDurationMs: args.maxDurationMs,
            pollAttempts: args.pollAttempts,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isInvalidContentLengthError(message) && args.fileType === "pdf") {
            return await runPdfBatchedOcrPass({
                fileBuffer: cloneArrayBuffer(args.fileBuffer),
                model: args.model,
                mode: args.mode,
                startedAt: args.startedAt,
                maxDurationMs: args.maxDurationMs,
                pollAttempts: args.pollAttempts,
            });
        }
        if (isInvalidContentLengthError(message) && args.fileType === "pptx") {
            return await runPptxLowTextImageOcrPass({
                fileBuffer: cloneArrayBuffer(args.fileBuffer),
                model: args.model,
                mode: args.mode,
                startedAt: args.startedAt,
                maxDurationMs: args.maxDurationMs,
                pollAttempts: args.pollAttempts,
                nativePages: args.nativePages,
            });
        }
        throw error;
    }
};

const textScore = (page: CandidatePage) => {
    const chars = page.text.length;
    const words = countWords(page.text);
    const lexical = lexicalRatio(page.text);
    const charScore = clamp(chars / 2200, 0, 1);
    const wordScore = clamp(words / 320, 0, 1);
    const tableBonus = clamp(page.tableCount / 2, 0, 1) * 0.08;
    const formulaBonus = clamp(page.formulaCount / 2, 0, 1) * 0.07;
    return charScore * 0.45 + wordScore * 0.3 + lexical * 0.25 + tableBonus + formulaBonus;
};

const chooseBestPage = (
    index: number,
    layoutPage: CandidatePage | undefined,
    readPage: CandidatePage | undefined,
    nativePage: CandidatePage | undefined
): ExtractionPage => {
    const candidates = [layoutPage, readPage, nativePage].filter(Boolean) as CandidatePage[];

    if (candidates.length === 0) {
        return {
            index,
            text: "",
            source: "none",
            chars: 0,
            words: 0,
            lexicalRatio: 0,
            tableCount: 0,
            formulaCount: 0,
            score: 0,
        };
    }

    let best = candidates[0];
    let bestScore = textScore(best);
    for (let i = 1; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const candidateScore = textScore(candidate);
        if (candidateScore > bestScore) {
            best = candidate;
            bestScore = candidateScore;
        }
    }

    const text = sanitizeText(best.text);
    return {
        index,
        text,
        source: best.source,
        chars: text.length,
        words: countWords(text),
        lexicalRatio: lexicalRatio(text),
        tableCount: Number(best.tableCount || 0),
        formulaCount: Number(best.formulaCount || 0),
        score: clamp(bestScore, 0, 1),
    };
};

const mergePassPages = (nativePass: PassResult, layoutPass: PassResult, readPass: PassResult): ExtractionPage[] => {
    const expectedPageCount = Math.max(
        Number(nativePass.pageCount || 0),
        Number(layoutPass.pageCount || 0),
        Number(readPass.pageCount || 0),
        1
    );

    const layoutByIndex = new Map(layoutPass.pages.map((page) => [page.index, page]));
    const readByIndex = new Map(readPass.pages.map((page) => [page.index, page]));
    const nativeByIndex = new Map(nativePass.pages.map((page) => [page.index, page]));

    const merged: ExtractionPage[] = [];
    for (let index = 0; index < expectedPageCount; index += 1) {
        merged.push(
            chooseBestPage(
                index,
                layoutByIndex.get(index),
                readByIndex.get(index),
                nativeByIndex.get(index)
            )
        );
    }

    // Pass D: targeted weak-page promotion from read/layout alternatives.
    for (let index = 0; index < merged.length; index += 1) {
        const current = merged[index];
        const weakCurrent = current.chars < 120 || current.words < 20 || current.lexicalRatio < 0.28;
        if (!weakCurrent) continue;
        const readCandidate = readByIndex.get(index);
        if (readCandidate && textScore(readCandidate) > current.score + 0.08) {
            merged[index] = chooseBestPage(index, undefined, readCandidate, undefined);
            continue;
        }
        const layoutCandidate = layoutByIndex.get(index);
        if (layoutCandidate && textScore(layoutCandidate) > current.score + 0.08) {
            merged[index] = chooseBestPage(index, layoutCandidate, undefined, undefined);
        }
    }

    return merged;
};

const buildMetrics = (args: {
    fileType: string;
    pages: ExtractionPage[];
    nativePass: PassResult;
    layoutPass: PassResult;
    readPass: PassResult;
}): PipelineMetrics => {
    const expectedPageCount = Math.max(args.pages.length, 1);
    const presentPages = args.pages.filter((page) => page.chars >= 40 || page.words >= 8).length;
    const weakPages = args.pages.filter((page) => page.chars < 120 || page.words < 20 || page.lexicalRatio < 0.28).length;

    const pagePresenceRatio = clamp(presentPages / expectedPageCount, 0, 1);
    const weakPageRatio = clamp(weakPages / expectedPageCount, 0, 1);

    const detectedTables = Math.max(args.layoutPass.tableCount, args.readPass.tableCount, 0);
    const recoveredTables = args.pages.reduce((sum, page) => sum + Number(page.tableCount || 0), 0);
    const tableRecoveryRatio = detectedTables > 0
        ? clamp(recoveredTables / detectedTables, 0, 1)
        : 1;

    const detectedFormulas = Math.max(args.layoutPass.formulaCount, args.readPass.formulaCount, 0);
    const recoveredFormulas = args.pages.reduce((sum, page) => sum + Number(page.formulaCount || 0), 0);
    const formulaRecoveryRatio = detectedFormulas > 0
        ? clamp(recoveredFormulas / detectedFormulas, 0, 1)
        : 1;
    const formulaMarkerLoss = clamp(1 - formulaRecoveryRatio, 0, 1);

    const nativeChars = String(args.nativePass.text || "").length;
    const ocrChars = Math.max(String(args.layoutPass.text || "").length, String(args.readPass.text || "").length);
    const scannedLikely = nativeChars < 500 && ocrChars > 1500;

    const qualityScore = clamp(
        pagePresenceRatio * 0.45
        + (1 - weakPageRatio) * 0.25
        + tableRecoveryRatio * 0.15
        + formulaRecoveryRatio * 0.15,
        0,
        1
    );

    const normalizedFileType = normalizeUploadFileType(args.fileType);
    const requiredPagePresence = normalizedFileType === "pptx"
        ? STRICT_PAGE_PRESENCE_PPTX_THRESHOLD
        : (scannedLikely ? STRICT_PAGE_PRESENCE_SCANNED_THRESHOLD : STRICT_PAGE_PRESENCE_THRESHOLD);
    const weakPageThreshold = normalizedFileType === "pptx"
        ? STRICT_WEAK_PAGE_RATIO_PPTX_THRESHOLD
        : STRICT_WEAK_PAGE_RATIO_THRESHOLD;

    const strictPass =
        qualityScore >= STRICT_QUALITY_THRESHOLD
        && pagePresenceRatio >= requiredPagePresence
        && weakPageRatio <= weakPageThreshold
        && tableRecoveryRatio >= STRICT_TABLE_RECOVERY_THRESHOLD
        && formulaMarkerLoss <= STRICT_FORMULA_LOSS_THRESHOLD;

    return {
        fileType: normalizedFileType,
        qualityScore,
        coverage: pagePresenceRatio,
        strictPass,
        provisional: !strictPass,
        pagePresenceRatio,
        weakPageRatio,
        tableRecoveryRatio,
        formulaMarkerLoss,
        expectedPageCount,
        scannedLikely,
        requiredPagePresence,
        weakPageThreshold,
    };
};

const buildWarnings = (metrics: PipelineMetrics) => {
    const warnings: string[] = [];
    const pagePresenceThreshold = metrics.requiredPagePresence;

    if (metrics.pagePresenceRatio < pagePresenceThreshold) {
        warnings.push("Page coverage is below strict threshold; some pages may be incomplete.");
    }
    if (metrics.weakPageRatio > metrics.weakPageThreshold) {
        warnings.push("Too many weak pages were detected; OCR quality appears inconsistent.");
    }
    if (metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD) {
        warnings.push("Table extraction coverage is low for this document.");
    }
    if (metrics.formulaMarkerLoss > STRICT_FORMULA_LOSS_THRESHOLD) {
        warnings.push("Formula retention is below strict threshold.");
    }

    return warnings;
};

export const shouldRunDoclingFallback = (args: {
    fileType: string;
    metrics: PipelineMetrics;
    nativePass: PassResult;
    layoutPass: PassResult;
    readPass: PassResult;
}): boolean => {
    const fileType = normalizeUploadFileType(args.fileType);
    if (!["pdf", "docx", "png", "jpg", "jpeg", "webp"].includes(fileType)) {
        return false;
    }

    if (fileType === "pdf" && args.metrics.scannedLikely) {
        return true;
    }
    if (fileType === "pdf" && args.metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD) {
        return true;
    }
    if (args.metrics.weakPageRatio > args.metrics.weakPageThreshold) {
        return true;
    }
    if (fileType === "docx" && args.metrics.qualityScore < STRICT_QUALITY_THRESHOLD) {
        return true;
    }

    const nativeChars = String(args.nativePass.text || "").length;
    const recoveredChars = Math.max(
        String(args.layoutPass.text || "").length,
        String(args.readPass.text || "").length
    );
    if ((fileType === "pdf" || fileType === "png" || fileType === "jpg" || fileType === "jpeg" || fileType === "webp")
        && nativeChars < 400
        && recoveredChars > 1200
    ) {
        return true;
    }

    return false;
};

export const selectDoclingParser = (args: {
    fileType: string;
    metrics: PipelineMetrics;
    layoutPass: PassResult;
    readPass: PassResult;
}): DoclingParserId | null => {
    const fileType = normalizeUploadFileType(args.fileType);
    if (fileType === "pdf" && args.metrics.scannedLikely) {
        return "enhanced_pdf";
    }
    if (
        fileType === "pdf"
        && (
            args.metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD
            || Math.max(args.layoutPass.tableCount, args.readPass.tableCount, 0) >= 2
        )
    ) {
        return "paddleocr_vl";
    }
    if (fileType === "docx") {
        return "docx_structured";
    }
    if (["png", "jpg", "jpeg", "webp"].includes(fileType)) {
        return "image_ocr";
    }
    return null;
};

const getDoclingFallbackRecommendation = (args: {
    fileType: string;
    metrics: PipelineMetrics;
    nativePass: PassResult;
    layoutPass: PassResult;
    readPass: PassResult;
}): ExtractionFallbackRecommendation | null => {
    if (!isDoclingEnabled()) {
        return null;
    }
    if (!shouldRunDoclingFallback(args)) {
        return null;
    }

    const parser = selectDoclingParser(args);
    if (!parser) {
        return null;
    }

    let reason = "weak_document_candidate";
    if (args.metrics.scannedLikely) {
        reason = "scanned_document_candidate";
    } else if (args.metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD) {
        reason = "table_recovery_candidate";
    } else if (String(args.fileType || "").toLowerCase() === "docx") {
        reason = "structured_docx_candidate";
    } else if (args.metrics.weakPageRatio > args.metrics.weakPageThreshold) {
        reason = "weak_page_ratio_candidate";
    }

    return {
        backend: "docling",
        parser,
        reason,
    };
};

export const shouldRunLlamaParseFallback = (args: {
    fileType: string;
    metrics: PipelineMetrics;
}): boolean => {
    if (!isLlamaParseEnabled()) {
        return false;
    }

    const fileType = normalizeUploadFileType(args.fileType);
    if (!["pdf", "pptx"].includes(fileType)) {
        return false;
    }

    if (args.metrics.strictPass) {
        return false;
    }

    // Keep scanned, table-heavy, and formula-loss-heavy documents on the
    // Docling path. LlamaParse is only a fallback for weaker Azure quality on
    // otherwise normal PDF/PPTX layouts.
    if (args.metrics.scannedLikely) {
        return false;
    }
    if (args.metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD) {
        return false;
    }
    if (args.metrics.formulaMarkerLoss > STRICT_FORMULA_LOSS_THRESHOLD) {
        return false;
    }

    return true;
};

const getLlamaParseFallbackRecommendation = (args: {
    fileType: string;
    metrics: PipelineMetrics;
}): ExtractionFallbackRecommendation | null => {
    if (!shouldRunLlamaParseFallback(args)) {
        return null;
    }

    let reason = "azure_quality_weak_candidate";
    if (args.metrics.pagePresenceRatio < args.metrics.requiredPagePresence) {
        reason = "page_coverage_candidate";
    } else if (args.metrics.weakPageRatio > args.metrics.weakPageThreshold) {
        reason = "weak_page_ratio_candidate";
    }

    return {
        backend: "llamaparse",
        parser: "llamaparse",
        reason,
    };
};

const getAzureFallbackRecommendation = (args: {
    fileType: string;
    metrics: PipelineMetrics;
    nativePass: PassResult;
    layoutPass: PassResult;
    readPass: PassResult;
}): ExtractionFallbackRecommendation | null => {
    const doclingFallback = getDoclingFallbackRecommendation(args);
    if (doclingFallback && doclingFallback.reason !== "weak_page_ratio_candidate") {
        return doclingFallback;
    }

    const llamaParseFallback = getLlamaParseFallbackRecommendation(args);
    if (llamaParseFallback) {
        return llamaParseFallback;
    }

    return doclingFallback;
};

const buildDocumentExtractionResult = (args: {
    backend: ExtractionBackendId;
    parser: ExtractionParserId;
    fileType: string;
    nativePass: PassResult;
    layoutPass: PassResult;
    readPass: PassResult;
    providerTrace: ExtractionPassTrace[];
    fallbackRecommendation?: ExtractionFallbackRecommendation | null;
    artifactMetadata?: ExtractionArtifactMetadata | Record<string, unknown>;
}): DocumentExtractionResult => {
    const mergedPages = mergePassPages(
        args.nativePass,
        args.layoutPass,
        args.readPass
    );
    const mergedText = sanitizeText(
        mergedPages
            .map((page) => page.text)
            .filter(Boolean)
            .join("\n\n\f\n\n")
    );

    const metrics = buildMetrics({
        fileType: args.fileType,
        pages: mergedPages,
        nativePass: args.nativePass,
        layoutPass: args.layoutPass,
        readPass: args.readPass,
    });

    const warnings = buildWarnings(metrics);

    return {
        backend: args.backend,
        parser: args.parser,
        text: mergedText,
        qualityScore: metrics.qualityScore,
        coverage: metrics.coverage,
        strictPass: metrics.strictPass,
        provisional: !metrics.strictPass,
        warnings,
        pageCount: metrics.expectedPageCount,
        providerTrace: args.providerTrace,
        fallbackRecommendation: args.fallbackRecommendation || null,
        artifact: {
            version: EXTRACTION_VERSION,
            backend: args.backend,
            parser: args.parser,
            fileType: String(args.fileType || "").toLowerCase(),
            expectedPageCount: metrics.expectedPageCount,
            pages: mergedPages,
            metrics,
            warnings,
            metadata: args.artifactMetadata,
            generatedAt: Date.now(),
        },
    };
};

const toDoclingPassResult = (payload: DoclingExtractResponse): PassResult => {
    const rawPages = Array.isArray(payload.pages) ? payload.pages : [];
    const pages: CandidatePage[] = rawPages
        .map((page) => ({
            index: Math.max(0, Number(page.index || 0)),
            text: sanitizeText(String(page.text || "")),
            source: "docling" as const,
            tableCount: Math.max(0, Number(page.tableCount || 0)),
            formulaCount: Math.max(0, Number(page.formulaCount || 0)),
        }))
        .filter((page) => Boolean(page.text));

    return {
        text: sanitizeText(String(payload.text || "")),
        pages,
        pageCount: Math.max(Number(payload.pageCount || 0), pages.length, 1),
        tableCount: Math.max(0, Number(payload.metrics?.tableCount || 0)),
        formulaCount: Math.max(0, Number(payload.metrics?.formulaCount || 0)),
    };
};

const normalizeDoclingBlocks = (payload: DoclingExtractResponse): DoclingBlock[] => {
    const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
    return blocks
        .map((block, index) => {
            const text = sanitizeText(String(block?.text || ""));
            const page = Math.max(0, Math.floor(Number(block?.page || 0)));
            const id = String(block?.id || `docling-p${page + 1}-${index}`).trim();
            const blockType = String(block?.blockType || "paragraph").trim() || "paragraph";
            if (!id || !text) return null;
            return {
                id,
                page,
                blockType,
                sectionHint: sanitizeText(String(block?.sectionHint || "")).slice(0, 160),
                headingPath: Array.isArray(block?.headingPath)
                    ? block.headingPath.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 12)
                    : [],
                text,
                startChar: Math.max(0, Math.floor(Number(block?.startChar || 0))),
                endChar: Math.max(0, Math.floor(Number(block?.endChar || text.length))),
                flags: Array.isArray(block?.flags)
                    ? block.flags.map((flag) => String(flag || "").trim()).filter(Boolean).slice(0, 12)
                    : [],
                source: "docling",
            } satisfies DoclingBlock;
        })
        .filter((block): block is DoclingBlock => Boolean(block));
};

const toDataLabPassResult = (payload: DataLabExtractResponse): PassResult => {
    const rawPages = Array.isArray(payload.pages) ? payload.pages : [];
    const pages: CandidatePage[] = rawPages
        .map((page) => ({
            index: Math.max(0, Number(page.index || 0)),
            text: sanitizeText(String(page.text || page.markdown || "")),
            source: "datalab" as const,
            tableCount: Math.max(0, Number(page.tableCount || 0)),
            formulaCount: Math.max(0, Number(page.formulaCount || 0)),
        }))
        .filter((page) => Boolean(page.text));

    const text = sanitizeText(String(payload.text || payload.markdown || ""));
    return {
        text,
        pages: pages.length > 0 ? pages : splitTextIntoSyntheticPages(text, "datalab"),
        pageCount: Math.max(Number(payload.pageCount || 0), pages.length, text ? 1 : 0),
        tableCount: pages.reduce((sum, page) => sum + Number(page.tableCount || 0), 0),
        formulaCount: pages.reduce((sum, page) => sum + Number(page.formulaCount || 0), 0),
    };
};

const toLlamaParsePassResult = (payload: LlamaParseExtractResponse): PassResult => {
    const rawPages = Array.isArray(payload.pages) ? payload.pages : [];
    const pages: CandidatePage[] = rawPages
        .map((page) => {
            const markdown = sanitizeText(String(page.markdown || ""));
            const text = sanitizeText(String(page.text || "")) || markdown;
            const tableCount = markdown ? (markdown.match(/^\|.+\|$/gm) || []).length : 0;
            const formulaCount = markdown ? (markdown.match(/\$[^$\n]+\$/g) || []).length : 0;
            return {
                index: Math.max(0, Number(page.index || 0)),
                text,
                source: "llamaparse" as const,
                tableCount,
                formulaCount,
            };
        })
        .filter((page) => Boolean(page.text));

    const text = sanitizeText(String(payload.text || ""));
    return {
        text,
        pages: pages.length > 0 ? pages : splitTextIntoSyntheticPages(text, "llamaparse"),
        pageCount: Math.max(Number(payload.pageCount || 0), pages.length, 1),
        tableCount: pages.reduce((sum, page) => sum + Number(page.tableCount || 0), 0),
        formulaCount: pages.reduce((sum, page) => sum + Number(page.formulaCount || 0), 0),
    };
};

const runPassWithTrace = async (
    pass: string,
    run: () => Promise<PassResult>
): Promise<{ result: PassResult; trace: ExtractionPassTrace }> => {
    const start = Date.now();
    try {
        const result = await run();
        return {
            result,
            trace: {
                pass,
                status: result.text ? "ok" : "skipped",
                latencyMs: Date.now() - start,
                chars: String(result.text || "").length,
                pageCount: Number(result.pageCount || 0),
            },
        };
    } catch (error) {
        return {
            result: {
                text: "",
                pages: [],
                pageCount: 0,
                tableCount: 0,
                formulaCount: 0,
            },
            trace: {
                pass,
                status: "error",
                latencyMs: Date.now() - start,
                chars: 0,
                pageCount: 0,
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
};

export const runAzureExtractionCandidate = async (
    args: RunDocumentExtractionArgs
): Promise<DocumentExtractionResult> => {
    const startedAt = Date.now();
    const normalizedFileType = normalizeUploadFileType(args.fileType, args.fileName);
    const contentType = mapUploadTypeToContentType(normalizedFileType);
    const nativeBuffer = cloneArrayBuffer(args.fileBuffer);
    const layoutBuffer = cloneArrayBuffer(args.fileBuffer);
    const readBuffer = cloneArrayBuffer(args.fileBuffer);

    const nativePassWithTrace = await runPassWithTrace("native", async () =>
        runNativePass(normalizedFileType, nativeBuffer)
    );

    const azurePollAttempts = args.mode === "background" ? 45 : 30;
    // Run both Azure passes in parallel — they are independent of each other
    // (both only depend on the native pass result for PPTX slide pages).
    const [layoutPassWithTrace, readPassWithTrace] = await Promise.all([
        runPassWithTrace("azure_layout", async () =>
            runAzurePass({
                fileBuffer: layoutBuffer,
                contentType,
                fileType: normalizedFileType,
                model: "prebuilt-layout",
                mode: args.mode,
                startedAt,
                maxDurationMs: args.maxDurationMs,
                pollAttempts: azurePollAttempts,
                nativePages: nativePassWithTrace.result.pages,
            })
        ),
        runPassWithTrace("azure_read", async () =>
            runAzurePass({
                fileBuffer: readBuffer,
                contentType,
                fileType: normalizedFileType,
                model: "prebuilt-read",
                mode: args.mode,
                startedAt,
                maxDurationMs: args.maxDurationMs,
                pollAttempts: azurePollAttempts,
                nativePages: nativePassWithTrace.result.pages,
            })
        ),
    ]);

    const targetedRetryTrace: ExtractionPassTrace = {
        pass: "targeted_retry",
        status: "ok",
        latencyMs: 0,
        chars: 0,
        pageCount: 0,
    };

    const result = buildDocumentExtractionResult({
        backend: "azure",
        parser: "azure_layout_read",
        fileType: normalizedFileType,
        nativePass: nativePassWithTrace.result,
        layoutPass: layoutPassWithTrace.result,
        readPass: readPassWithTrace.result,
        providerTrace: [
            nativePassWithTrace.trace,
            layoutPassWithTrace.trace,
            readPassWithTrace.trace,
            targetedRetryTrace,
        ],
        fallbackRecommendation: getAzureFallbackRecommendation({
            fileType: normalizedFileType,
            metrics: buildMetrics({
                fileType: normalizedFileType,
                pages: mergePassPages(
                    nativePassWithTrace.result,
                    layoutPassWithTrace.result,
                    readPassWithTrace.result
                ),
                nativePass: nativePassWithTrace.result,
                layoutPass: layoutPassWithTrace.result,
                readPass: readPassWithTrace.result,
            }),
            nativePass: nativePassWithTrace.result,
            layoutPass: layoutPassWithTrace.result,
            readPass: readPassWithTrace.result,
        }),
    });

    targetedRetryTrace.chars = result.text.length;
    targetedRetryTrace.pageCount = result.pageCount;
    return result;
};

export const runDataLabExtractionCandidate = async (
    args: RunDocumentExtractionArgs
): Promise<DocumentExtractionResult> => {
    if (!isDataLabEnabled()) {
        throw new Error("Datalab extraction is not configured.");
    }

    const startedAt = Date.now();
    const normalizedFileType = normalizeUploadFileType(args.fileType, args.fileName);
    const contentType = mapUploadTypeToContentType(normalizedFileType);
    const nativePassPromise = normalizedFileType === "pptx" || normalizedFileType === "docx"
        ? runNativePass(normalizedFileType, cloneArrayBuffer(args.fileBuffer))
        : Promise.resolve(emptyPassResult());
    const payloadPromise = callDataLabExtract({
        fileName: args.fileName,
        contentType,
        fileBuffer: cloneArrayBuffer(args.fileBuffer),
        timeoutMs: args.maxDurationMs,
        mode: "accurate",
        maxPages: normalizedFileType === "pdf"
            ? (args.mode === "background"
                ? Math.max(PDF_BATCH_MAX_PAGES_BACKGROUND, 80)
                : Math.max(PDF_BATCH_MAX_PAGES_FOREGROUND, 24))
            : undefined,
    });
    const [nativePass, payload] = await Promise.all([nativePassPromise, payloadPromise]);
    const latencyMs = Date.now() - startedAt;
    const dataLabPass = toDataLabPassResult(payload);
    const result = buildDocumentExtractionResult({
        backend: "datalab",
        parser: "datalab",
        fileType: normalizedFileType,
        nativePass,
        layoutPass: emptyPassResult(),
        readPass: dataLabPass,
        providerTrace: [{
            pass: `datalab_${payload.mode}`,
            status: "ok",
            latencyMs,
            chars: dataLabPass.text.length,
            pageCount: dataLabPass.pageCount,
        }],
        fallbackRecommendation: null,
        artifactMetadata: payload.metadata,
    });
    const warnings = Array.from(new Set([...(payload.warnings || []), ...result.warnings]));
    return {
        ...result,
        warnings,
        artifact: {
            ...result.artifact,
            warnings,
        },
    };
};

export const runDoclingExtractionCandidate = async (
    args: RunDocumentExtractionArgs
): Promise<DocumentExtractionResult> => {
    const startedAt = Date.now();
    const normalizedFileType = normalizeUploadFileType(args.fileType, args.fileName);
    const contentType = mapUploadTypeToContentType(normalizedFileType);
    const parser = (
        args.parser && args.parser !== "azure_layout_read"
            ? args.parser
            : selectDoclingParser({
                fileType: normalizedFileType,
                metrics: {
                    fileType: normalizedFileType,
                    qualityScore: 0,
                    coverage: 0,
                    strictPass: false,
                    provisional: true,
                    pagePresenceRatio: 0,
                    weakPageRatio: 1,
                    tableRecoveryRatio: 0,
                    formulaMarkerLoss: 0,
                    expectedPageCount: 1,
                    scannedLikely: normalizedFileType === "pdf",
                    requiredPagePresence: 0,
                    weakPageThreshold: 1,
                },
                layoutPass: emptyPassResult(),
                readPass: emptyPassResult(),
            })
    ) as DoclingClientParserId | null;

    if (!parser) {
        throw new Error(`No Docling parser available for file type: ${normalizedFileType}`);
    }

    const payload = await callDoclingExtract({
        fileName: args.fileName,
        contentType,
        fileBuffer: cloneArrayBuffer(args.fileBuffer),
        parser,
        maxPages: normalizedFileType === "pdf"
            ? (args.mode === "background"
                ? Math.max(PDF_BATCH_MAX_PAGES_BACKGROUND, 80)
                : Math.max(PDF_BATCH_MAX_PAGES_FOREGROUND, 24))
            : undefined,
    });
    const latencyMs = Date.now() - startedAt;
    const doclingPass = toDoclingPassResult(payload);
    const doclingBlocks = normalizeDoclingBlocks(payload);
    const result = buildDocumentExtractionResult({
        backend: "docling",
        parser,
        fileType: normalizedFileType,
        nativePass: emptyPassResult(),
        layoutPass: emptyPassResult(),
        readPass: doclingPass,
        providerTrace: [{
            pass: "docling",
            status: "ok",
            latencyMs,
            chars: doclingPass.text.length,
            pageCount: doclingPass.pageCount,
        }],
        fallbackRecommendation: null,
        artifactMetadata: {
            doclingBlocks,
        },
    });
    const warnings = Array.from(new Set([...(payload.warnings || []), ...result.warnings]));
    return {
        ...result,
        warnings,
        artifact: {
            ...result.artifact,
            warnings,
        },
    };
};

export const runLlamaParseExtractionCandidate = async (
    args: RunDocumentExtractionArgs
): Promise<DocumentExtractionResult> => {
    if (!isLlamaParseEnabled()) {
        throw new Error("LlamaParse extraction is not configured.");
    }

    const startedAt = Date.now();
    const normalizedFileType = normalizeUploadFileType(args.fileType, args.fileName);
    const contentType = mapUploadTypeToContentType(normalizedFileType);
    const payload = await callLlamaParseExtract({
        fileName: args.fileName,
        contentType,
        fileBuffer: cloneArrayBuffer(args.fileBuffer),
        timeoutMs: args.maxDurationMs,
    });
    const latencyMs = Date.now() - startedAt;
    const llamaParsePass = toLlamaParsePassResult(payload);

    return buildDocumentExtractionResult({
        backend: "llamaparse",
        parser: "llamaparse",
        fileType: normalizedFileType,
        nativePass: emptyPassResult(),
        layoutPass: emptyPassResult(),
        readPass: llamaParsePass,
        providerTrace: [{
            pass: `llamaparse_${payload.tier}`,
            status: "ok",
            latencyMs,
            chars: llamaParsePass.text.length,
            pageCount: llamaParsePass.pageCount,
        }],
        fallbackRecommendation: null,
    });
};

export const runDocumentExtractionPipeline = async (
    args: RunDocumentExtractionArgs
): Promise<DocumentExtractionResult> => {
    if (args.backend === "datalab") {
        return await runDataLabExtractionCandidate(args);
    }
    if (args.backend === "docling") {
        return await runDoclingExtractionCandidate(args);
    }
    if (args.backend === "llamaparse") {
        return await runLlamaParseExtractionCandidate(args);
    }
    if (args.backend === "azure") {
        return await runAzureExtractionCandidate(args);
    }
    if (isDoclingEnabled()) {
        const fileType = normalizeUploadFileType(args.fileType, args.fileName);
        const primaryDoclingParser: DoclingParserId | null =
            fileType === "docx"
                ? "docx_structured"
                : ["png", "jpg", "jpeg", "webp"].includes(fileType)
                    ? "image_ocr"
                    : null;
        const doclingStartedAt = Date.now();
        try {
            return await runDoclingExtractionCandidate({
                ...args,
                backend: "docling",
                parser: args.parser || primaryDoclingParser,
            });
        } catch (error) {
            const errorSummary = summarizeExtractionError(error);
            const fallback = await runAzureExtractionCandidate({
                ...args,
                backend: "azure",
                parser: "azure_layout_read",
            });
            const warnings = Array.from(new Set([
                `docling_primary_failed:${errorSummary.slice(0, 180)}`,
                ...fallback.warnings,
            ]));
            return {
                ...fallback,
                warnings,
                providerTrace: [
                    {
                        pass: "docling_primary",
                        status: "error",
                        latencyMs: Date.now() - doclingStartedAt,
                        chars: 0,
                        pageCount: 0,
                        error: errorSummary,
                    },
                    ...fallback.providerTrace,
                ],
                artifact: {
                    ...fallback.artifact,
                    warnings,
                    metadata: {
                        ...(fallback.artifact.metadata || {}),
                        doclingPrimaryError: errorSummary,
                    },
                },
            };
        }
    }
    return await runDataLabExtractionCandidate(args);
};
