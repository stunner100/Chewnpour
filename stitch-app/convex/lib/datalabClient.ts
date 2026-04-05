"use node";

import { Blob } from "node:buffer";

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

const DATALAB_API_KEY = String(process.env.DATALAB_API_KEY || "").trim();
const DATALAB_API_BASE_URL = String(process.env.DATALAB_API_BASE_URL || "https://www.datalab.to")
    .trim()
    .replace(/\/+$/, "");
const DATALAB_TIMEOUT_MS = Number(process.env.DATALAB_TIMEOUT_MS || 240000);
const DATALAB_POLL_INTERVAL_MS = Number(process.env.DATALAB_POLL_INTERVAL_MS || 1500);

const PAGINATED_MARKDOWN_PAGE_PATTERN = /^\{(\d+)\}-{20,}\s*$/gm;

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
    String(value || "")
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

const normalizeStructuredTopic = (value: any, index: number): DataLabStructuredTopic | null => {
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
        return Array.from(ids).slice(0, 24);
    })();
    const sourcePages = (() => {
        const pages = new Set<number>();
        collectStructuredNumericValues(topic, ["page", "pages", "page_number", "page_numbers"], pages);
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

const normalizeStructuredCourseMap = (value: any): DataLabStructuredCourseMap | null => {
    const parsed = unwrapStructuredValue(value) || {};
    const rawTopics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    const topics = rawTopics
        .map((entry, index) => normalizeStructuredTopic(entry, index))
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

const parsePaginatedMarkdown = (markdown: string): DataLabPage[] => {
    const source = String(markdown || "");
    const matches = Array.from(source.matchAll(PAGINATED_MARKDOWN_PAGE_PATTERN));
    if (matches.length === 0) {
        const cleaned = sanitizeText(source);
        if (!cleaned) return [];
        return [{
            index: 0,
            text: cleaned,
            markdown: cleaned,
            chars: cleaned.length,
            tableCount: countMarkdownTables(cleaned),
            formulaCount: countFormulaMarkers(cleaned),
        }];
    }

    const pages: DataLabPage[] = [];
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const pageIndex = Math.max(0, Number(match[1] || index));
        const start = match.index! + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index! : source.length;
        const pageMarkdown = sanitizeText(source.slice(start, end));
        if (!pageMarkdown) continue;

        pages.push({
            index: pageIndex,
            text: pageMarkdown,
            markdown: pageMarkdown,
            chars: pageMarkdown.length,
            tableCount: countMarkdownTables(pageMarkdown),
            formulaCount: countFormulaMarkers(pageMarkdown),
        });
    }

    return pages;
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
    formData.set("output_format", "markdown");
    formData.set("mode", args.mode);
    formData.set("paginate", "true");
    formData.set("token_efficient_markdown", "true");
    formData.set("page_schema", JSON.stringify(DATALAB_STRUCTURED_COURSE_SCHEMA));
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

const pollConvertRequest = async (args: {
    requestCheckUrl: string;
    timeoutMs: number;
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
            throw new Error(`Datalab error: ${String(payload?.error || "conversion failed")}`);
        }
        await sleep(pollIntervalMs);
    }

    throw new Error("Datalab error: convert request timed out");
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
    const payload = await pollConvertRequest({
        requestCheckUrl: submitted.requestCheckUrl,
        timeoutMs,
    });

    const markdown = sanitizeText(String(payload?.markdown || ""));
    const pages = parsePaginatedMarkdown(markdown);
    const text = sanitizeText(markdown);
    const parseQualityScore = Math.max(0, Number(payload?.parse_quality_score || 0));
    const checkpointId = sanitizeText(String(payload?.checkpoint_id || submitted.checkpointId || ""));
    const structuredCourseMap = normalizeStructuredCourseMap(parseStructuredExtractionPayload(payload));
    const warnings: string[] = [];
    if (!text) {
        warnings.push("empty_markdown_output");
    }
    if (parseQualityScore > 0 && parseQualityScore < 4) {
        warnings.push(`low_parse_quality_score:${parseQualityScore}`);
    }
    if (!structuredCourseMap) {
        warnings.push("structured_course_map_unavailable");
    }

    const metadata = {
        ...(typeof payload?.metadata === "object" && payload.metadata
            ? payload.metadata as Record<string, unknown>
            : {}),
        checkpointId: checkpointId || undefined,
        structuredCourseMap: structuredCourseMap || undefined,
    };

    return {
        backend: "datalab",
        mode,
        requestId: submitted.requestId,
        checkpointId: checkpointId || undefined,
        text,
        markdown,
        pageCount: Math.max(Number(payload?.page_count || 0), pages.length, text ? 1 : 0),
        pages,
        parseQualityScore,
        structuredCourseMap,
        warnings,
        metadata,
    };
};
