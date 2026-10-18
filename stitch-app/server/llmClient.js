import { recordGenerationRun } from "./generationRuns.js";

// OpenAI-compatible chat calls with provider fallback (The Grid, then
// DeepSeek, then Inception). All providers share one time budget per call,
// a caller's AbortSignal cancels the request in flight, and a reply cut off
// at max_tokens is an error, not a result. Every attempt is recorded in
// generation_runs.

const resolveBaseUrl = (value, fallback) => {
    const raw = String(value || fallback || "").trim();
    if (!raw) return "";
    return raw.endsWith("/") ? raw : `${raw}/`;
};

const isPlaceholderUrl = (value) => /your_resource_name/i.test(String(value || ""));

const PROVIDERS = [
    {
        name: "grid",
        keyEnv: "GRID_API_KEY",
        baseUrl: resolveBaseUrl(process.env.GRID_BASE_URL, "https://api.thegrid.ai/v1/"),
        model: String(process.env.GRID_MODEL || "text-prime").trim() || "text-prime",
        timeoutMs: Number(process.env.GRID_TIMEOUT_MS || 60000),
    },
    {
        name: "deepseek",
        keyEnv: "DEEPSEEK_API_KEY",
        baseUrl: resolveBaseUrl(process.env.DEEPSEEK_BASE_URL, "https://api.deepseek.com/v1/"),
        model: String(process.env.DEEPSEEK_DOCUMENT_FLASH_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash").trim()
            || "deepseek-v4-flash",
        timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS || 60000),
    },
    {
        name: "inception",
        keyEnv: "INCEPTION_API_KEY",
        baseUrl: resolveBaseUrl(process.env.INCEPTION_BASE_URL, "https://api.inceptionlabs.ai/v1/"),
        model: String(process.env.INCEPTION_MODEL || "mercury-2").trim() || "mercury-2",
        timeoutMs: Number(process.env.INCEPTION_TIMEOUT_MS || 60000),
    },
];

// Total time one call may spend across providers.
const DEFAULT_BUDGET_MS = Number(process.env.COURSE_LLM_BUDGET_MS || 90000);
// Below this much remaining budget, the next provider is not tried.
const MIN_ATTEMPT_MS = 1500;

const configuredProviders = () => PROVIDERS
    .map((provider) => ({ ...provider, apiKey: String(process.env[provider.keyEnv] || "").trim() }))
    .filter((provider) => provider.apiKey && provider.baseUrl && !isPlaceholderUrl(provider.baseUrl));

const courseAiFlagEnabled = () => {
    const flag = String(process.env.COURSE_AI_ENABLED || "true").trim().toLowerCase();
    return !["0", "false", "no", "off"].includes(flag);
};

export const isCourseAiEnabled = () => courseAiFlagEnabled() && configuredProviders().length > 0;

export class LlmTruncatedError extends Error {
    constructor({ provider, model, usage }) {
        super(`${provider} stopped at the max_tokens limit; the reply is incomplete.`);
        this.name = "LlmTruncatedError";
        this.provider = provider;
        this.model = model;
        this.usage = usage;
    }
}

export class LlmAbortedError extends Error {
    constructor(message = "The model call was cancelled.") {
        super(message);
        this.name = "LlmAbortedError";
    }
}

class AttemptError extends Error {
    constructor(outcome, message) {
        super(message);
        this.outcome = outcome;
    }
}

const attemptProvider = async ({ provider, timeoutMs, signal, messages, temperature, maxTokens, responseFormat }) => {
    // One controller ends the request on either the per-attempt timeout or
    // the caller's signal.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener("abort", onCallerAbort, { once: true });
    try {
        const response = await fetch(new URL("chat/completions", provider.baseUrl).toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify({
                model: provider.model,
                messages,
                temperature,
                max_tokens: maxTokens,
                response_format: responseFormat ? { type: responseFormat } : undefined,
            }),
            signal: controller.signal,
            // The Grid routes to suppliers through 307 redirects.
            redirect: "follow",
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new AttemptError(
                "http_error",
                `${provider.name} API error: ${response.status} - ${String(errorText || "").replace(/\s+/g, " ").trim().slice(0, 300)}`,
            );
        }
        const data = await response.json();
        const choice = data?.choices?.[0];
        return {
            text: String(choice?.message?.content || "").trim(),
            finishReason: choice?.finish_reason || null,
            model: data?.model || provider.model,
            provider: provider.name,
            usage: data?.usage || null,
        };
    } catch (error) {
        if (error instanceof AttemptError) throw error;
        if (signal?.aborted) throw new AttemptError("aborted", `${provider.name} call cancelled`);
        if (timedOut) throw new AttemptError("timeout", `${provider.name} request timed out after ${timeoutMs}ms`);
        throw new AttemptError("network_error", `${provider.name} request failed: ${error?.message || String(error)}`);
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onCallerAbort);
    }
};

// Usage records are best-effort: a failed write never fails the model call.
const safeRecord = async (recordRun, entry) => {
    try {
        await recordRun(entry);
    } catch (error) {
        console.warn("[llmClient] failed to record model call", { message: error?.message || String(error) });
    }
};

// run: { purpose, label, userId, courseId, uploadId, topicId } for the
// generation_runs record. recordRun is injectable for tests.
export const callCourseLlmChat = async ({
    messages,
    temperature = 0.2,
    maxTokens = 4096,
    responseFormat = null,
    signal = null,
    budgetMs = DEFAULT_BUDGET_MS,
    run = {},
    recordRun = recordGenerationRun,
} = {}) => {
    const providers = configuredProviders();
    if (providers.length === 0) throw new Error("No course LLM provider is configured.");
    const deadline = Date.now() + budgetMs;
    const errors = [];

    for (const provider of providers) {
        if (signal?.aborted) throw new LlmAbortedError();
        const remaining = deadline - Date.now();
        if (remaining < MIN_ATTEMPT_MS) {
            errors.push(`${provider.name}: not tried, time budget used up`);
            break;
        }
        const started = Date.now();
        let result = null;
        let failure = null;
        try {
            result = await attemptProvider({
                provider,
                timeoutMs: Math.min(provider.timeoutMs, remaining),
                signal,
                messages,
                temperature,
                maxTokens,
                responseFormat,
            });
        } catch (error) {
            failure = error;
        }
        const outcome = failure
            ? failure.outcome
            : result.finishReason === "length"
                ? "truncated"
                : result.text ? "ok" : "empty";
        await safeRecord(recordRun, {
            ...run,
            provider: provider.name,
            model: result?.model || provider.model,
            outcome,
            finishReason: result?.finishReason,
            promptTokens: result?.usage?.prompt_tokens,
            completionTokens: result?.usage?.completion_tokens,
            totalTokens: result?.usage?.total_tokens,
            latencyMs: Date.now() - started,
            error: failure?.message,
        });

        if (outcome === "ok") return { ...result, latencyMs: Date.now() - started };
        // A longer reply needs a larger max_tokens, not another provider.
        if (outcome === "truncated") throw new LlmTruncatedError(result);
        if (outcome === "aborted") throw new LlmAbortedError();
        errors.push(failure?.message || `${provider.name} API error: empty response.`);
    }

    throw new Error(`Course LLM providers failed: ${errors.join(" | ")}`);
};
