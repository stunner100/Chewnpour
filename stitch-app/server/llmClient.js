const resolveBaseUrl = (value, fallback) => {
    const raw = String(value || fallback || "").trim();
    if (!raw) return "";
    return raw.endsWith("/") ? raw : `${raw}/`;
};

const isPlaceholderUrl = (value) => /your_resource_name/i.test(String(value || ""));

const GRID_BASE_URL = resolveBaseUrl(
    process.env.GRID_BASE_URL,
    "https://api.thegrid.ai/v1/",
);
const GRID_MODEL = String(process.env.GRID_MODEL || "text-prime").trim() || "text-prime";
const GRID_TIMEOUT_MS = Number(process.env.GRID_TIMEOUT_MS || 60000);

const DEEPSEEK_BASE_URL = resolveBaseUrl(
    process.env.DEEPSEEK_BASE_URL,
    "https://api.deepseek.com/v1/",
);
const DEEPSEEK_MODEL =
    String(process.env.DEEPSEEK_DOCUMENT_FLASH_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash").trim() ||
    "deepseek-v4-flash";
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 60000);

const INCEPTION_BASE_URL = resolveBaseUrl(
    process.env.INCEPTION_BASE_URL,
    "https://api.inceptionlabs.ai/v1/",
);
const INCEPTION_MODEL = String(process.env.INCEPTION_MODEL || "mercury-2").trim() || "mercury-2";
const INCEPTION_TIMEOUT_MS = Number(process.env.INCEPTION_TIMEOUT_MS || 60000);

const courseAiFlagEnabled = () => {
    const flag = String(process.env.COURSE_AI_ENABLED || "true").trim().toLowerCase();
    return !["0", "false", "no", "off"].includes(flag);
};

export const isCourseAiEnabled = () => {
    if (!courseAiFlagEnabled()) return false;
    const gridKey = String(process.env.GRID_API_KEY || "").trim();
    const deepseekKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
    const inceptionKey = String(process.env.INCEPTION_API_KEY || "").trim();
    const gridOk = Boolean(gridKey) && !isPlaceholderUrl(GRID_BASE_URL);
    const deepseekOk = Boolean(deepseekKey) && !isPlaceholderUrl(DEEPSEEK_BASE_URL);
    const inceptionOk = Boolean(inceptionKey) && !isPlaceholderUrl(INCEPTION_BASE_URL);
    return gridOk || deepseekOk || inceptionOk;
};

const callOpenAiCompatibleChat = async ({
    provider,
    baseUrl,
    apiKey,
    model,
    messages,
    temperature = 0.2,
    maxTokens = 4096,
    responseFormat = null,
    timeoutMs = 60000,
    redirect = "follow",
}) => {
    if (!apiKey) {
        throw new Error(`${provider} API key environment variable not set.`);
    }
    if (!baseUrl || isPlaceholderUrl(baseUrl)) {
        throw new Error(`${provider} base URL environment variable not configured.`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs) || 60000));

    try {
        const response = await fetch(new URL("chat/completions", baseUrl).toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
                response_format: responseFormat ? { type: responseFormat } : undefined,
            }),
            signal: controller.signal,
            redirect,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(
                `${provider} API error: ${response.status} - ${String(errorText || "").replace(/\s+/g, " ").trim().slice(0, 300)}`,
            );
        }

        const data = await response.json();
        const responseText = String(data?.choices?.[0]?.message?.content || "").trim();
        if (!responseText) {
            throw new Error(`${provider} API error: empty response.`);
        }
        return {
            text: responseText,
            model: data?.model || model,
            provider,
            usage: data?.usage || null,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/aborted|timed out/i.test(message)) {
            throw new Error(`${provider} request timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const callCourseLlmChat = async (args) => {
    const errors = [];

    // The Grid first: OpenAI-compatible spot market (follows 307 supplier redirects).
    const gridKey = String(process.env.GRID_API_KEY || "").trim();
    if (gridKey && !isPlaceholderUrl(GRID_BASE_URL)) {
        try {
            return await callOpenAiCompatibleChat({
                provider: "grid",
                baseUrl: GRID_BASE_URL,
                apiKey: gridKey,
                model: GRID_MODEL,
                timeoutMs: args.timeoutMs ?? GRID_TIMEOUT_MS,
                ...args,
            });
        } catch (error) {
            errors.push(error?.message || String(error));
        }
    }

    const deepseekKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
    if (deepseekKey && !isPlaceholderUrl(DEEPSEEK_BASE_URL)) {
        try {
            return await callOpenAiCompatibleChat({
                provider: "deepseek",
                baseUrl: DEEPSEEK_BASE_URL,
                apiKey: deepseekKey,
                model: DEEPSEEK_MODEL,
                timeoutMs: args.timeoutMs ?? DEEPSEEK_TIMEOUT_MS,
                ...args,
            });
        } catch (error) {
            errors.push(error?.message || String(error));
        }
    }

    const inceptionKey = String(process.env.INCEPTION_API_KEY || "").trim();
    if (inceptionKey && !isPlaceholderUrl(INCEPTION_BASE_URL)) {
        try {
            return await callOpenAiCompatibleChat({
                provider: "inception",
                baseUrl: INCEPTION_BASE_URL,
                apiKey: inceptionKey,
                model: INCEPTION_MODEL,
                timeoutMs: args.timeoutMs ?? INCEPTION_TIMEOUT_MS,
                ...args,
            });
        } catch (error) {
            errors.push(error?.message || String(error));
        }
    }

    throw new Error(
        errors.length
            ? `Course LLM providers failed: ${errors.join(" | ")}`
            : "No course LLM provider is configured.",
    );
};

// Back-compat alias used by earlier milestone scripts.
export const callDeepSeekChat = callCourseLlmChat;
