// callCourseLlmChat: a reply cut off at max_tokens is an error, providers
// share one time budget, a caller's AbortSignal cancels the request in flight
// and stops fallback, and every attempt is recorded for usage tracking.
import assert from 'node:assert/strict';

console.warn = () => {};

process.env.GRID_API_KEY = 'test-grid';
process.env.DEEPSEEK_API_KEY = 'test-deepseek';
delete process.env.INCEPTION_API_KEY;
process.env.COURSE_AI_ENABLED = 'true';

const { callCourseLlmChat, isCourseAiEnabled, LlmAbortedError, LlmTruncatedError } = await import('../server/llmClient.js');

const messages = [{ role: 'user', content: 'hi' }];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const completion = (text, finishReason = 'stop') => ({
    model: 'served-model',
    choices: [{ message: { content: text }, finish_reason: finishReason }],
    usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
});
// A request that only ends when its signal aborts.
const hang = (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
});

const withFetch = async (handlers, call) => {
    const original = globalThis.fetch;
    const hosts = [];
    globalThis.fetch = async (url, init) => {
        const host = new URL(url).host;
        hosts.push(host);
        return handlers[host](url, init);
    };
    try {
        return { result: await call(), hosts };
    } finally {
        globalThis.fetch = original;
    }
};
const recorder = () => {
    const runs = [];
    return { runs, recordRun: async (run) => runs.push(run) };
};

assert.equal(isCourseAiEnabled(), true);

// Success: text, finish reason and usage come back, and the call is recorded.
{
    const { runs, recordRun } = recorder();
    const { result, hosts } = await withFetch(
        { 'api.thegrid.ai': () => reply(completion('Hello there')) },
        () => callCourseLlmChat({ messages, run: { purpose: 'lesson', label: 'Osmosis', courseId: 'c1' }, recordRun }),
    );
    assert.equal(result.text, 'Hello there');
    assert.equal(result.provider, 'grid');
    assert.equal(result.finishReason, 'stop');
    assert.deepEqual(hosts, ['api.thegrid.ai']);
    assert.equal(runs.length, 1);
    assert.deepEqual(
        { ...runs[0], latencyMs: undefined },
        {
            purpose: 'lesson',
            label: 'Osmosis',
            courseId: 'c1',
            provider: 'grid',
            model: 'served-model',
            outcome: 'ok',
            finishReason: 'stop',
            promptTokens: 120,
            completionTokens: 40,
            totalTokens: 160,
            latencyMs: undefined,
            error: undefined,
        },
    );
}

// A reply stopped at max_tokens throws, and no other provider is tried.
{
    const { runs, recordRun } = recorder();
    const { hosts } = await withFetch(
        { 'api.thegrid.ai': () => reply(completion('{"lesson": {"sections": [', 'length')) },
        () => assert.rejects(callCourseLlmChat({ messages, recordRun }), (error) => error instanceof LlmTruncatedError && error.provider === 'grid'),
    );
    assert.deepEqual(hosts, ['api.thegrid.ai']);
    assert.equal(runs[0].outcome, 'truncated');
    assert.equal(runs[0].finishReason, 'length');
}

// A failing provider falls back to the next; both attempts are recorded.
{
    const { runs, recordRun } = recorder();
    const { result } = await withFetch(
        {
            'api.thegrid.ai': () => new Response('upstream overloaded', { status: 503 }),
            'api.deepseek.com': () => reply(completion('From DeepSeek')),
        },
        () => callCourseLlmChat({ messages, recordRun }),
    );
    assert.equal(result.provider, 'deepseek');
    assert.deepEqual(runs.map((run) => [run.provider, run.outcome]), [['grid', 'http_error'], ['deepseek', 'ok']]);
    assert.match(runs[0].error, /503 - upstream overloaded/);
}

// Providers share one budget: a hung first provider uses it up and the
// second is not tried.
{
    const { runs, recordRun } = recorder();
    const started = Date.now();
    const { hosts } = await withFetch(
        { 'api.thegrid.ai': hang, 'api.deepseek.com': () => reply(completion('too late')) },
        () => assert.rejects(callCourseLlmChat({ messages, budgetMs: 1700, recordRun }), /grid request timed out.*deepseek: not tried, time budget used up/),
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed >= 1600 && elapsed < 3000, `the call ends with its budget (${elapsed}ms)`);
    assert.deepEqual(hosts, ['api.thegrid.ai']);
    assert.deepEqual(runs.map((run) => run.outcome), ['timeout']);
}

// A caller's abort cancels the request in flight and stops fallback.
{
    const { runs, recordRun } = recorder();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const { hosts } = await withFetch(
        { 'api.thegrid.ai': hang, 'api.deepseek.com': () => reply(completion('should not run')) },
        () => assert.rejects(callCourseLlmChat({ messages, signal: controller.signal, recordRun }), LlmAbortedError),
    );
    assert.deepEqual(hosts, ['api.thegrid.ai']);
    assert.deepEqual(runs.map((run) => run.outcome), ['aborted']);
    await assert.rejects(callCourseLlmChat({ messages, signal: controller.signal, recordRun }), LlmAbortedError, 'an already-aborted signal makes no request');
}

// Empty replies fall back; a failing recorder never fails the call.
{
    const { result } = await withFetch(
        {
            'api.thegrid.ai': () => reply(completion('')),
            'api.deepseek.com': () => reply(completion('Second try')),
        },
        () => callCourseLlmChat({ messages, recordRun: async () => { throw new Error('db down'); } }),
    );
    assert.equal(result.provider, 'deepseek');
    assert.equal(result.text, 'Second try');
}

console.log('llm-client-regression.test.mjs passed');
