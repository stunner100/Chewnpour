import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/unused";

const {
    checkLiveTutorQuota,
    getLiveTutorLimits,
    DEFAULT_LIVE_TUTOR_DAILY_LIMIT,
    DEFAULT_LIVE_TUTOR_HOURLY_LIMIT,
    LIVE_TUTOR_SESSION_MINUTES,
} = await import("../server/liveTutor.js");
const { createLiveTutorAudioContexts, downsample } = await import("../src/lib/liveTutorAudio.js");

// 1. Cost guard: bounded sessions per student, short tokens, slot reserved
//    under a per-user lock and released when minting fails.
{
    assert.deepEqual(getLiveTutorLimits({}), {
        hourly: DEFAULT_LIVE_TUTOR_HOURLY_LIMIT,
        daily: DEFAULT_LIVE_TUTOR_DAILY_LIMIT,
    });
    assert.deepEqual(getLiveTutorLimits({ LIVE_TUTOR_HOURLY_LIMIT: "3", LIVE_TUTOR_DAILY_LIMIT: "nope" }), {
        hourly: 3,
        daily: DEFAULT_LIVE_TUTOR_DAILY_LIMIT,
    });
    const limits = { hourly: 2, daily: 5 };
    assert.equal(checkLiveTutorQuota({ hourCount: 1, dayCount: 1, limits }).allowed, true);
    assert.match(checkLiveTutorQuota({ hourCount: 2, dayCount: 2, limits }).message, /this hour/);
    assert.match(checkLiveTutorQuota({ hourCount: 0, dayCount: 5, limits }).message, /today/);
    assert.ok(LIVE_TUTOR_SESSION_MINUTES <= 15, "ephemeral tokens stay short");

    const server = await read("server/liveTutor.js");
    assert.match(server, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/, "quota check is race-safe");
    assert.match(server, /DELETE FROM live_tutor_sessions WHERE id = \$1/, "failed mints don't use up quota");
    assert.match(server, /expireTime = new Date\(Date\.now\(\) \+ LIVE_TUTOR_SESSION_MINUTES/);
    assert.match(server, /error\.status = 429/);
    assert.match(server, /WHERE id = \$1 AND user_id = \$2/, "only the owner can report a session's end");

    const http = await read("server/courseHttp.js");
    assert.match(http, /parts\[3\] === "end"/, "end-of-session route exists");

    const migration = await read("supabase/migrations/20261016140000_live_tutor_sessions.sql");
    assert.match(migration, /REVOKE ALL ON TABLE "live_tutor_sessions" FROM anon, authenticated/);
}

// 2. Dropped sessions release the mic and keep the conversation.
{
    const hook = await read("src/hooks/useGeminiLiveTutor.js");
    const onclose = hook.slice(hook.indexOf("onclose: () => {"), hook.indexOf("},", hook.indexOf("onclose: () => {")));
    assert.match(onclose, /handleDropRef\.current/, "remote close releases resources");
    assert.doesNotMatch(onclose, /applyStatus\('idle'\)/, "remote close no longer just flips to idle with the mic on");
    const onerror = hook.slice(hook.indexOf("onerror: (event) => {"), hook.indexOf("onclose: () => {"));
    assert.match(onerror, /handleDropRef\.current/, "errors release resources");
    const handleDrop = hook.slice(hook.indexOf("const handleDrop = async"), hook.indexOf("handleDropRef.current = handleDrop;"));
    assert.match(handleDrop, /finishReviewRef\.current\('disconnected'\)/, "partial conversations are saved");
    assert.match(handleDrop, /stop\(\{ status: 'error' \}\)/, "empty sessions stop the mic and show an error");
    assert.doesNotMatch(hook, /setTranscript\(\(current\) => \{\s*if \(!current\.length\)/, "no side effects inside state updaters");
    assert.match(handleDrop, /commitAssistantCaptionRef\.current\(\)/, "an in-flight tutor caption is kept on drop");
    const newTurn = hook.slice(hook.indexOf("if (!activePlayer.isPlaying() && captionCommittedRef.current) {"), hook.indexOf("applyStatus('speaking');"));
    assert.doesNotMatch(newTurn, /pendingCaptionRef\.current = ''/, "a new turn's first audio must not wipe its already-transcribed opening words");
}

// 3. Audio setup: contexts created inside the click, mic asked before a
//    session is minted, mic context at the device rate.
{
    const hook = await read("src/hooks/useGeminiLiveTutor.js");
    const start = hook.slice(hook.indexOf("const start = useCallback(async () => {"));
    const contextsAt = start.replace(/\/\/.*$/gm, "").indexOf("createLiveTutorAudioContexts()");
    const code = start.replace(/\/\/.*$/gm, "");
    const firstAwait = code.indexOf("await ");
    assert.ok(contextsAt > 0 && contextsAt < firstAwait, "audio contexts are created before the first await");
    assert.ok(start.indexOf("await startMicCapture(") < start.indexOf("/live-tutor`"), "mic permission comes before minting a session");
    assert.ok(start.indexOf("/live-tutor`") < start.indexOf("sendRealtimeInput({ text: KICKOFF_TEXT })"));

    const created = [];
    class FakeContext {
        constructor(options = {}) {
            this.options = options;
            this.state = "suspended";
            this.resumed = 0;
            created.push(this);
        }
        resume() {
            this.resumed += 1;
            this.state = "running";
            return Promise.resolve();
        }
    }
    const { input, output } = createLiveTutorAudioContexts({ AudioContextImpl: FakeContext });
    assert.equal(created.length, 2);
    assert.equal(output.options.sampleRate, 24000);
    assert.equal(input.options.sampleRate, undefined, "mic context runs at the device rate (Firefox)");
    assert.equal(input.resumed + output.resumed, 2, "both contexts resume within the gesture");

    const audio = await read("src/lib/liveTutorAudio.js");
    assert.doesNotMatch(audio, /new AudioContext\(\{ sampleRate: INPUT_SAMPLE_RATE \}\)/);

    const samples = Float32Array.from([1, -1, 1, -1, 0.5, 0.5]);
    assert.deepEqual(Array.from(downsample(samples, 48000, 16000)), [1 / 3, 0].map((value) => Math.fround(value)),
        "downsampling averages each window instead of picking one sample");
    assert.equal(downsample(samples, 16000, 16000), samples);
}

// 4. Recap detection tolerates phrasing drift; end reports are best-effort.
{
    const { RECAP_PATTERN, reportLiveTutorEnd } = await import("../src/hooks/useGeminiLiveTutor.js");
    {
        for (const line of ["Recap: cells…", "recap - cells", "Here's a quick recap of cells", "To sum up, cells…", "Summary: cells"]) {
            assert.ok(RECAP_PATTERN.test(line), line);
        }
        assert.ok(!RECAP_PATTERN.test("What does a recap mean?"));
        const calls = [];
        reportLiveTutorEnd("topic 1", "sess", "completed", 3, (url, init) => {
            calls.push([url, JSON.parse(init.body), init.keepalive]);
            return Promise.resolve();
        });
        assert.deepEqual(calls, [["/api/topics/topic%201/live-tutor/sess/end", { outcome: "completed", answered: 3 }, true]]);
        reportLiveTutorEnd("t", null, "completed", 0, () => assert.fail("no session, no report"));
    }
}

// 5. Usage is visible: live reviews count as activity and in the dashboard.
{
    const metrics = await read("server/adminMetrics.js");
    assert.match(metrics, /FROM live_tutor_sessions WHERE created_at >= NOW\(\) - INTERVAL '30 days'/);
    assert.match(metrics, /liveSessionsTotal/);
    const overview = await read("src/pages/admin/panels/OverviewPanel.jsx");
    assert.ok(overview.includes("Live oral reviews"));
}

// 6. Database: public tables are not exposed to the Supabase API roles.
{
    const lock = await read("supabase/migrations/20261016130000_lock_public_tables.sql");
    for (const table of ["exam_attempts", "topic_passages"]) {
        assert.ok(lock.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`));
        assert.ok(lock.includes(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated;`));
    }
    assert.match(lock, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL ON TABLES FROM anon, authenticated/);

    const dir = path.join(root, "supabase", "migrations");
    const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".sql") && file > "20261016130000");
    for (const file of files) {
        const sql = await fs.readFile(path.join(dir, file), "utf8");
        for (const [, table] of sql.matchAll(/CREATE TABLE IF NOT EXISTS "([a-z_]+)"/g)) {
            assert.ok(sql.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`), `${file}: ${table} enables RLS`);
        }
    }
}

console.log("live-tutor-audit regression checks passed");
