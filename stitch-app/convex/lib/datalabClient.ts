"use node";

import { Blob } from "node:buffer";
import { cleanDataLabBlockText } from "./datalabText";

export type DataLabMode = "fast" | "balanced" | "accurate";

export type DataLabStructuredDefinition = {
    term: string;
    meaning: string;
};

export type DataLabStructuredTopic = {
    title: string;
    description: string;
    keyPoints: string[];
    subtopics: string[];
    definitions: DataLabStructuredDefinition[];
    examples: string[];
    formulas: string[];
    likelyConfusions: string[];
    learningObjectives: string[];
    sourceBlockIds: string[];
    sourcePages: number[];
};

export type DataLabStructuredCourseMap = {
    courseTitle: string;
    courseDescription: string;
    topics: DataLabStructuredTopic[];
};

export type DataLabPage = {
    index: number;
    text: string;
    markdown: string;
    chars: number;
    tableCount: number;
    formulaCount: number;
};

export type DataLabExtractResponse = {
    backend: "datalab";
    mode: DataLabMode;
    requestId: string;
    checkpointId?: string;
    text: string;
    markdown: string;
    pageCount: number;
    pages: DataLabPage[];
    parseQualityScore: number;
    structuredCourseMap?: DataLabStructuredCourseMap | null;
    warnings?: string[];
    metadata?: Record<string, unknown>;
};

type DataLabChunkBlock = {
    id: string;
    page: number;
    blockType?: string;
    sectionHint?: string;
    text: string;
};

const DATALAB_API_KEY = String(process.env.DATALAB_API_KEY || "").trim();
const DATALAB_API_BASE_URL = String(process.env.DATALAB_API_BASE_URL || "https://www.datalab.to")
    .trim()
    .replace(/\/+$/, "");
const DATALAB_TIMEOUT_MS = Number(process.env.DATALAB_TIMEOUT_MS || 240000);
const DATALAB_POLL_INTERVAL_MS = Number(process.env.DATALAB_POLL_INTERVAL_MS || 1500);

const DATALAB_STRUCTURED_COURSE_SCHEMA = {
    type: "object",
    properties: {
        courseTitle: {
            type: "string",
            description: "Clear title for the full course represented by the document.",
        },
        courseDescription: {
            type: "string",
            description: "One or two sentence summary of what the learner will learn from the document.",
        },
        topics: {
            type: "array",
            description: "Ordered list of major teachable topics explicitly grounded in the document.",
            items: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "Focused topic title drawn from the document structure.",
                    },
                    description: {
                        type: "string",
                        description: "Brief explanation of what this topic covers.",
                    },
                    keyPoints: {
                        type: "array",
                        description: "Atomic key ideas explicitly supported by the document.",
                        items: { type: "string" },
                    },
                    subtopics: {
                        type: "array",
                        description: "Ordered subtopics or section headings that belong to this topic.",
                        items: { type: "string" },
                    },
                    definitions: {
                        type: "array",
                        description: "Terms and their grounded meanings from the document.",
                        items: {
                            type: "object",
                            properties: {
                                term: { type: "string" },
                                meaning: { type: "string" },
                            },
                            required: ["term", "meaning"],
                        },
                    },
                    examples: {
                        type: "array",
                        description: "Concrete examples or worked cases present in the document.",
                        items: { type: "string" },
                    },
                    formulas: {
                        type: "array",
                        description: "Formulas, equations, or symbolic expressions present in the document.",
                        items: { type: "string" },
                    },
                    likelyConfusions: {
                        type: "array",
                        description: "Commonly confused ideas, pitfalls, or contrast points implied by the document.",
                        items: { type: "string" },
                    },
                    learningObjectives: {
                        type: "array",
                        description: "Things a learner should be able to explain, identify, or apply after this topic.",
                        items: { type: "string" },
                    },
                },
                required: ["title", "description", "keyPoints"],
            },
        },
    },
    required: ["courseTitle", "courseDescription", "topics"],
} as const;

const sanitizeText = (value: string) =>
    cleanDataLabBlockText(String(value || ""))
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const unwrapStructuredValue = (value: any): any => {
    if (Array.isArray(value)) {
        return value.map((entry) => unwrapStructuredValue(entry));
    }
    if (value && typeof value === "object") {
        if ("value" in value && Object.keys(value).length <= 3) {
            return unwrapStructuredValue(value.value);
        }
        const normalized: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            normalized[key] = unwrapStructuredValue(entry);
        }
        return normalized;
    }
    return value;
};

const normalizeStructuredString = (value: any, maxChars = 240) =>
    sanitizeText(String(unwrapStructuredValue(value) || "")).slice(0, maxChars);

const normalizeStructuredStringList = (value: any, maxItems = 8, maxChars = 220) => {
    const unwrapped = unwrapStructuredValue(value);
    const source = Array.isArray(unwrapped) ? unwrapped : [];
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const entry of source) {
        const normalized = normalizeStructuredString(entry, maxChars);
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key)) continue;
        seen.add(key);
        deduped.push(normalized);
        if (deduped.length >= maxItems) break;
    }
    return deduped;
};

const normalizeStructuredDefinitions = (value: any) => {
    const unwrapped = unwrapStructuredValue(value);
    const source = Array.isArray(unwrapped) ? unwrapped : [];
    const definitions: DataLabStructuredDefinition[] = [];
    const seen = new Set<string>();
    for (const entry of source) {
        const term = normalizeStructuredString((entry as any)?.term, 120);
        const meaning = normalizeStructuredString((entry as any)?.meaning, 280);
        const key = `${term.toLowerCase()}::${meaning.toLowerCase()}`;
        if (!term || !meaning || seen.has(key)) continue;
        seen.add(key);
        definitions.push({ term, meaning });
        if (definitions.length >= 12) break;
    }
    return definitions;
};

const collectStructuredFieldValues = (value: any, keys: string[], collector: Set<string>) => {
    if (Array.isArray(value)) {
        for (const entry of value) {
            collectStructuredFieldValues(entry, keys, collector);
        }
        return;
    }
    if (!value || typeof value !== "object") return;

    for (const [key, entry] of Object.entries(value)) {
        const normalizedKey = String(key || "").toLowerCase();
        if (keys.includes(normalizedKey)) {
            const entries = Array.isArray(entry) ? entry : [entry];
            for (const item of entries) {
                const normalized = sanitizeText(String(item || ""));
                if (normalized) collector.add(normalized);
            }
        }
        collectStructuredFieldValues(entry, keys, collector);
    }
};

const collectStructuredNumericValues = (value: any, keys: string[], collector: Set<number>) => {
    if (Array.isArray(value)) {
        for (const entry of value) {
            collectStructuredNumericValues(entry, keys, collector);
        }
        return;
    }
    if (!value || typeof value !== "object") return;

    for (const [key, entry] of Object.entries(value)) {
        const normalizedKey = String(key || "").toLowerCase();
        if (keys.includes(normalizedKey)) {
            const entries = Array.isArray(entry) ? entry : [entry];
            for (const item of entries) {
                const numeric = Number(item);
                if (Number.isFinite(numeric) && numeric >= 0) {
                    collector.add(Math.floor(numeric));
                }
            }
        }
        collectStructuredNumericValues(entry, keys, collector);
    }
};

const collectCitationBlockIds = (value: any, collector: Set<string>) => {
    if (Array.isArray(value)) {
        for (const entry of value) {
            collectCitationBlockIds(entry, collector);
        }
        return;
    }
    if (!value || typeof value !== "object") return;

    for (const [key, entry] of Object.entries(value)) {
        const normalizedKey = String(key || "").toLowerCase();
        if (normalizedKey === "citations" || normalizedKey.endsWith("_citations")) {
            const entries = Array.isArray(entry) ? entry : [entry];
            for (const item of entries) {
                const normalized = sanitizeText(String(item || ""));
                if (normalized) collector.add(normalized);
            }
        }
        collectCitationBlockIds(entry, collector);
    }
};

const parseStructuredExtractionPayload = (value: any) => {
    const raw = value?.extraction_schema_json;
    if (!raw) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }
    return typeof raw === "object" ? raw : null;
};

const normalizeStructuredTopic = (
    value: any,
    index: number,
    blockPageById?: Map<string, number>
): DataLabStructuredTopic | null => {
    const topic = unwrapStructuredValue(value) || {};
    const title = normalizeStructuredString(topic?.title, 120) || `Topic ${index + 1}`;
    const description = normalizeStructuredString(topic?.description, 320);
    const keyPoints = normalizeStructuredStringList(topic?.keyPoints, 8, 180);
    const subtopics = normalizeStructuredStringList(topic?.subtopics, 10, 140);
    const definitions = normalizeStructuredDefinitions(topic?.definitions);
    const examples = normalizeStructuredStringList(topic?.examples, 8, 220);
    const formulas = normalizeStructuredStringList(topic?.formulas, 8, 160);
    const likelyConfusions = normalizeStructuredStringList(topic?.likelyConfusions, 8, 180);
    const learningObjectives = normalizeStructuredStringList(topic?.learningObjectives, 8, 180);
    const sourceBlockIds = (() => {
        const ids = new Set<string>();
        collectStructuredFieldValues(topic, ["block_id", "block_ids", "blockid", "blockids"], ids);
        collectCitationBlockIds(topic, ids);
        return Array.from(ids).slice(0, 24);
    })();
    const sourcePages = (() => {
        const pages = new Set<number>();
        collectStructuredNumericValues(topic, ["page", "pages", "page_number", "page_numbers"], pages);
        for (const blockId of sourceBlockIds) {
            const page = blockPageById?.get(blockId);
            if (Number.isFinite(page) && page! >= 0) {
                pages.add(Math.floor(page!));
            }
        }
        return Array.from(pages).sort((a, b) => a - b).slice(0, 24);
    })();

    if (!title || (!description && keyPoints.length === 0 && subtopics.length === 0)) {
        return null;
    }

    return {
        title,
        description,
        keyPoints,
        subtopics,
        definitions,
        examples,
        formulas,
        likelyConfusions,
        learningObjectives,
        sourceBlockIds,
        sourcePages,
    };
};

const normalizeStructuredCourseMap = (
    value: any,
    blockPageById?: Map<string, number>
): DataLabStructuredCourseMap | null => {
    const parsed = unwrapStructuredValue(value) || {};
    const rawTopics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    const topics = rawTopics
        .map((entry, index) => normalizeStructuredTopic(entry, index, blockPageById))
        .filter(Boolean) as DataLabStructuredTopic[];

    if (topics.length === 0) {
        return null;
    }

    const courseTitle = normalizeStructuredString(parsed?.courseTitle, 160)
        || normalizeStructuredString(parsed?.title, 160)
        || "Generated Course";
    const courseDescription = normalizeStructuredString(parsed?.courseDescription, 360)
        || normalizeStructuredString(parsed?.description, 360)
        || `Study topics extracted from ${topics.length} document sections.`;

    return {
        courseTitle,
        courseDescription,
        topics: topics.slice(0, 15),
    };
};

const countMarkdownTables = (value: string) =>
    (String(value || "").match(/^\|.+\|$/gm) || []).length;

const countFormulaMarkers = (value: string) =>
    (String(value || "").match(/\$[^$\n]+\$/g) || []).length;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toSafeTimeout = (value?: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return Math.max(30000, DATALAB_TIMEOUT_MS);
    }
    return Math.max(30000, Math.floor(parsed));
};

const withTimeout = async (input: string, init: RequestInit, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

const readResponseText = async (response: Response) =>
    await response.text().catch(() => "");

const toJson = async (response: Response) => {
    const bodyText = await readResponseText(response);
    if (!response.ok) {
        throw new Error(`Datalab error: ${response.status} - ${bodyText}`);
    }
    if (!bodyText) {
        throw new Error("Datalab error: empty response body");
    }
    try {
        return JSON.parse(bodyText);
    } catch (error) {
        throw new Error(
            `Datalab error: invalid JSON response (${error instanceof Error ? error.message : String(error)})`
        );
    }
};

const resolveCheckUrl = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) {
        throw new Error("Datalab error: missing request_check_url");
    }
    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }
    return `${DATALAB_API_BASE_URL}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const flattenChunkBlocks = (value: any): DataLabChunkBlock[] => {
    const blocksRoot = Array.isArray(value?.blocks)
        ? value.blocks
        : Array.isArray(value)
            ? value
            : [];
    const flattened: DataLabChunkBlock[] = [];
    const seen = new Set<string>();

    const visit = (entry: any) => {
        if (!entry || typeof entry !== "object") return;
        const unwrapped = unwrapStructuredValue(entry) || {};
        const rawId = sanitizeText(String(unwrapped.id || unwrapped.block_id || unwrapped.blockId || ""));
        const page = Number(
            unwrapped.page
            ?? unwrapped.page_idx
            ?? unwrapped.page_index
            ?? unwrapped.page_number
            ?? 0
        );
        const text = sanitizeText(String(
            unwrapped.text
            || unwrapped.markdown
            || unwrapped.html
            || unwrapped.content
            || ""
        ));
        const sectionHint = sanitizeText(String(
            unwrapped.section_hint
            || unwrapped.heading
            || unwrapped.block_type
            || ""
        )).slice(0, 180);
        const blockType = sanitizeText(String(unwrapped.block_type || unwrapped.type || "")).slice(0, 60);

        if (rawId && text && Number.isFinite(page) && page >= 0 && !seen.has(rawId)) {
            seen.add(rawId);
            flattened.push({
                id: rawId,
                page: Math.max(0, Math.floor(page)),
                blockType: blockType || undefined,
                sectionHint: sectionHint || undefined,
                text: text.slice(0, 2400),
            });
        }

        const children = Array.isArray(unwrapped.children)
            ? unwrapped.children
            : Array.isArray(unwrapped.blocks)
                ? unwrapped.blocks
                : [];
        for (const child of children) {
            visit(child);
        }
    };

    for (const block of blocksRoot) {
        visit(block);
    }
    return flattened;
};

const buildPagesFromChunkBlocks = (blocks: DataLabChunkBlock[]): DataLabPage[] => {
    const grouped = new Map<number, DataLabChunkBlock[]>();
    for (const block of blocks) {
        if (!grouped.has(block.page)) grouped.set(block.page, []);
        grouped.get(block.page)!.push(block);
    }

    return Array.from(grouped.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([pageIndex, pageBlocks]) => {
            const pageMarkdown = sanitizeText(pageBlocks.map((block) => block.text).join("\n\n"));
            return {
                index: pageIndex,
                text: pageMarkdown,
                markdown: pageMarkdown,
                chars: pageMarkdown.length,
                tableCount: countMarkdownTables(pageMarkdown),
                formulaCount: countFormulaMarkers(pageMarkdown),
            };
        })
        .filter((page) => page.text);
};

export const isDataLabEnabled = () =>
    Boolean(DATALAB_API_KEY && DATALAB_API_BASE_URL);

const submitConvertRequest = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    mode: DataLabMode;
    maxPages?: number;
    timeoutMs: number;
}) => {
    const formData = new FormData();
    formData.set("file", new Blob([args.fileBuffer], { type: args.contentType }), args.fileName);
    formData.set("output_format", "chunks");
    formData.set("mode", args.mode);
    formData.set("save_checkpoint", "true");
    if (Number.isFinite(Number(args.maxPages)) && Number(args.maxPages) > 0) {
        formData.set("max_pages", String(Math.floor(Number(args.maxPages))));
    }

    const response = await withTimeout(
        `${DATALAB_API_BASE_URL}/api/v1/marker`,
        {
            method: "POST",
            headers: {
                "X-API-Key": DATALAB_API_KEY,
            },
            body: formData,
        },
        args.timeoutMs
    );

    const payload = await toJson(response);
    const requestId = String(payload?.request_id || "").trim();
    const requestCheckUrl = resolveCheckUrl(String(payload?.request_check_url || ""));
    const checkpointId = String(payload?.checkpoint_id || "").trim();
    if (!requestId) {
        throw new Error("Datalab error: submit response missing request_id");
    }
    return {
        requestId,
        requestCheckUrl,
        checkpointId,
    };
};

const submitStructuredExtractRequest = async (args: {
    checkpointId: string;
    mode: DataLabMode;
    maxPages?: number;
    timeoutMs: number;
}) => {
    const formData = new FormData();
    formData.set("checkpoint_id", args.checkpointId);
    formData.set("page_schema", JSON.stringify(DATALAB_STRUCTURED_COURSE_SCHEMA));
    formData.set("mode", args.mode);
    if (Number.isFinite(Number(args.maxPages)) && Number(args.maxPages) > 0) {
        formData.set("max_pages", String(Math.floor(Number(args.maxPages))));
    }

    const response = await withTimeout(
        `${DATALAB_API_BASE_URL}/api/v1/extract`,
        {
            method: "POST",
            headers: {
                "X-API-Key": DATALAB_API_KEY,
            },
            body: formData,
        },
        args.timeoutMs
    );

    const payload = await toJson(response);
    const requestId = String(payload?.request_id || "").trim();
    const requestCheckUrl = resolveCheckUrl(String(payload?.request_check_url || ""));
    if (!requestId) {
        throw new Error("Datalab error: extract response missing request_id");
    }
    return {
        requestId,
        requestCheckUrl,
    };
};

const pollRequest = async (args: {
    requestCheckUrl: string;
    timeoutMs: number;
    purpose: string;
}) => {
    const deadline = Date.now() + args.timeoutMs;
    const pollIntervalMs = Math.max(500, DATALAB_POLL_INTERVAL_MS);

    while (Date.now() < deadline) {
        const remainingMs = Math.max(5000, deadline - Date.now());
        const response = await withTimeout(
            args.requestCheckUrl,
            {
                method: "GET",
                headers: {
                    "X-API-Key": DATALAB_API_KEY,
                },
            },
            remainingMs
        );
        const payload = await toJson(response);
        const status = String(payload?.status || "").trim().toLowerCase();
        if (status === "complete") {
            return payload;
        }
        if (status === "failed") {
            throw new Error(`Datalab error: ${String(payload?.error || `${args.purpose} failed`)}`);
        }
        await sleep(pollIntervalMs);
    }

    throw new Error(`Datalab error: ${args.purpose} request timed out`);
};

export const callDataLabExtract = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    timeoutMs?: number;
    mode?: DataLabMode;
    maxPages?: number;
}): Promise<DataLabExtractResponse> => {
    if (!isDataLabEnabled()) {
        throw new Error("Datalab is not configured.");
    }

    const timeoutMs = toSafeTimeout(args.timeoutMs);
    const mode = (String(args.mode || "accurate").trim().toLowerCase() || "accurate") as DataLabMode;
    const submitted = await submitConvertRequest({
        fileName: args.fileName,
        contentType: args.contentType,
        fileBuffer: args.fileBuffer,
        mode,
        maxPages: args.maxPages,
        timeoutMs,
    });
    const convertPayload = await pollRequest({
        requestCheckUrl: submitted.requestCheckUrl,
        timeoutMs,
        purpose: "convert",
    });
    const blocks = flattenChunkBlocks(convertPayload?.chunks);
    const blockPageById = new Map(blocks.map((block) => [block.id, block.page]));
    const pages = buildPagesFromChunkBlocks(blocks);
    const markdown = pages.map((page) => page.markdown).join("\n\n").trim();
    const text = sanitizeText(markdown);
    const parseQualityScore = Math.max(0, Number(convertPayload?.parse_quality_score || 0));
    const warnings: string[] = [];
    const checkpointId = sanitizeText(String(convertPayload?.checkpoint_id || submitted.checkpointId || ""));
    let extractPayload: any = null;
    if (checkpointId) {
        try {
            const extractSubmitted = await submitStructuredExtractRequest({
                checkpointId,
                mode,
                maxPages: args.maxPages,
                timeoutMs,
            });
            extractPayload = await pollRequest({
                requestCheckUrl: extractSubmitted.requestCheckUrl,
                timeoutMs,
                purpose: "extract",
            });
        } catch (error) {
            const message = sanitizeText(error instanceof Error ? error.message : String(error)).slice(0, 160);
            if (message) {
                warnings.push(`structured_extract_failed:${message}`);
            }
        }
    } else {
        warnings.push("checkpoint_unavailable");
    }
    const structuredCourseMap = normalizeStructuredCourseMap(
        parseStructuredExtractionPayload(extractPayload || convertPayload),
        blockPageById
    );
    if (!text) {
        warnings.push("empty_block_output");
    }
    if (parseQualityScore > 0 && parseQualityScore < 4) {
        warnings.push(`low_parse_quality_score:${parseQualityScore}`);
    }
    if (!structuredCourseMap) {
        warnings.push("structured_course_map_unavailable");
    }

    const metadata = {
        ...(typeof convertPayload?.metadata === "object" && convertPayload.metadata
            ? convertPayload.metadata as Record<string, unknown>
            : {}),
        checkpointId: checkpointId || undefined,
        datalabBlocks: blocks,
        structuredCourseMap: structuredCourseMap || undefined,
    };

    return {
        backend: "datalab",
        mode,
        requestId: submitted.requestId,
        checkpointId: checkpointId || undefined,
        text,
        markdown,
        pageCount: Math.max(Number(convertPayload?.page_count || 0), pages.length, text ? 1 : 0),
        pages,
        parseQualityScore,
        structuredCourseMap,
        warnings,
        metadata,
    };
};
