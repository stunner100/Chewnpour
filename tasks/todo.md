# Topic Concept Video Generation (Staging Only)

Generate short explainer video clips from a topic's document text using
OpenRouter `bytedance/seedance-2.0`. Surfaced on the TopicDetail page.
All staging users, no per-user cap during test.

## Decisions locked in

- **Source content**: topic document text (already extracted into Convex
  via `convex/extraction.ts` / `convex/topicNotes.ts`).
- **Output**: short explainer clip (target 5s text-to-video, expandable later).
- **Provider**: OpenRouter `bytedance/seedance-2.0` (confirmed listed,
  released 2026-04-15, price `(H*W*duration*24)/1024` tokens at $7/M).
- **Surface**: `src/pages/TopicDetail.jsx` — new "Generate explainer video"
  action in the topic toolbar.
- **Scope gate**: staging branch only; feature-flag off in production builds.
- **Limits**: no user-facing cap in staging; internal hard ceiling to prevent
  runaway spend (see Safety).

## Key numbers (for budget awareness)

| Resolution | Duration | Tokens   | Cost     |
|------------|----------|----------|----------|
| 720x1280   | 5s       | 108,000  | ~$0.76   |
| 720x1280   | 10s      | 216,000  | ~$1.52   |
| 1080x1920  | 5s       | 243,000  | ~$1.70   |

Default staging config: **720x1280, 5s** unless overridden.

---

## Step 0 — Verify the API contract

Done — contract captured below from OpenRouter's official docs
(`/docs/api/api-reference/video-generation/*`). No guessing needed.

### API contract (verified 2026-04-17 against OpenRouter docs)

**Submit**
- `POST https://openrouter.ai/api/v1/videos`
- Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`,
  `HTTP-Referer: <staging app url>`, `X-Title: Stitch (staging)`
- Body — required: `model` ("bytedance/seedance-2.0"), `prompt` (string).
- Body — optional we'll use:
  - `duration` (integer, seconds)
  - `resolution` (enum: `"480p" | "720p" | "1080p" | "1K" | "2K" | "4K"`)
    or `size` (`"WIDTHxHEIGHT"`) — pick one, not both.
  - `aspect_ratio` (enum: `"16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "9:21"`)
  - `seed` (int, deterministic)
  - `generate_audio` (bool)
- Body — optional we'll ignore in v1: `frame_images`, `input_references`,
  `provider`.
- Response 202:
  ```json
  { "id": "job-abc123",
    "polling_url": "https://openrouter.ai/api/v1/videos/job-abc123",
    "status": "pending" }
  ```

**Poll**
- `GET https://openrouter.ai/api/v1/videos/{jobId}` (same as `polling_url`).
- Status enum: `pending | in_progress | completed | failed | cancelled | expired`.
- On `completed`: response includes `generation_id`, `unsigned_urls[]`,
  `usage.cost` (USD), `usage.is_byok`.
- On `failed`: response includes `error` (string).

**Download**
- `GET https://openrouter.ai/api/v1/videos/{jobId}/content?index=0`
- Bearer auth required. Returns `application/octet-stream` (raw video bytes).
- **Use this, not `unsigned_urls`** — OpenRouter's authenticated passthrough
  is the only stable download path. `unsigned_urls` TTL is undocumented
  and they're served by the upstream provider.

**State mapping** (provider → our `status`):
- `pending` → `pending`
- `in_progress` → `running`
- `completed` → `ready`
- `failed` / `cancelled` / `expired` → `failed` (record original in
  `errorMessage` for diagnostics)

---

## Step 1 — Env wiring (staging only)

User is keeping the existing key for staging testing. Key must stay
server-side only.

- [ ] Add `OPENROUTER_VIDEO_API_KEY` to the **staging** Convex deployment:
      `npx convex env set OPENROUTER_VIDEO_API_KEY <key>` against the
      staging project. Do not set on production Convex.
- [ ] Add `OPENROUTER_VIDEO_API_KEY=...placeholder...` to `.env.example`
      with a comment noting it's only read by Convex actions. Never commit
      the real value.
- [ ] Confirm no bundler leakage: the key name must never appear inside
      `stitch-app/src/`. Vite inlines any `VITE_*` env; keep this key
      without the `VITE_` prefix so it cannot be imported client-side.
- [ ] Before the first live test, rotate the key once staging traffic
      starts flowing (key was previously pasted in a chat transcript).

---

## Step 2 — Data model (Convex)

Add to `convex/schema.ts`:

- [ ] New table `topicVideos` with fields:
  - `userId: string` (indexed)
  - `topicId: Id<"topics">` (indexed)
  - `conceptKey?: string` (optional — if we scope to a specific concept,
    not the whole topic)
  - `status: "pending" | "running" | "ready" | "failed"`
  - `providerJobId?: string` — OpenRouter job `id`
  - `pollingUrl?: string` — cached `polling_url` from submit response
  - `promptText: string` — the exact prompt sent to Seedance
  - `sourceSnippet: string` — the slice of topic text used, for audit
  - `durationSeconds: number`
  - `width: number`
  - `height: number`
  - `videoStorageId?: Id<"_storage">` — once rehosted
  - `providerUrl?: string` — original provider URL (may expire)
  - `tokenCount?: number`
  - `costUsd?: number`
  - `errorMessage?: string`
  - `createdAt: number`, `updatedAt: number`
- [ ] Indexes: `by_user`, `by_topic`, `by_status_and_createdAt`.

---

## Step 3 — Backend (Convex)

Create `convex/videos.ts`.

- [ ] `mutation requestTopicVideo({ topicId, conceptKey?, durationSeconds? })`
  - Auth: require signed-in user; verify topic ownership using the same
    helper pattern as [convex/uploads.ts:20](stitch-app/convex/uploads.ts:20)
    (`assertAuthorizedUser`).
  - Staging gate: reject with `FEATURE_DISABLED` unless
    `process.env.VIDEO_GEN_ENABLED === "true"`.
  - Rate safety: reject if user has an active `pending`/`running` row for
    this topic (one in flight at a time).
  - Global spend safety: reject if total `running` count across all users
    in the last hour exceeds `MAX_CONCURRENT_VIDEO_JOBS` (default 5).
  - Insert row with `status: "pending"`, schedule `internal.videos.kickoff`.
- [ ] `internalAction kickoff({ videoId })` (`"use node"`)
  - Load row.
  - Build prompt: take the topic's summary / notes (first ~800 chars of
    cleaned body from `topicNotes`) and wrap with a fixed system prompt:
    `"Create a short, clear, classroom-style explainer illustrating this
    concept. No on-screen text. Calm, educational tone. Subject: …"`
  - `POST https://openrouter.ai/api/v1/videos` with body:
    ```json
    { "model": "bytedance/seedance-2.0",
      "prompt": "<built prompt>",
      "duration": 5,
      "resolution": "720p",
      "aspect_ratio": "9:16",
      "generate_audio": false }
    ```
    Headers: `Authorization: Bearer ${OPENROUTER_VIDEO_API_KEY}`,
    `Content-Type: application/json`, `HTTP-Referer: <staging url>`,
    `X-Title: Stitch (staging)`.
  - Persist `providerJobId = response.id` and `pollingUrl = response.polling_url`.
  - Flip row to `status: "running"`.
  - Schedule `internal.videos.poll` at T+15s via `ctx.scheduler.runAfter`.
- [ ] `internalAction poll({ videoId })` (`"use node"`)
  - `GET https://openrouter.ai/api/v1/videos/{providerJobId}` with Bearer auth.
  - Map provider `status` per the "State mapping" above.
  - If `pending`/`in_progress`: re-schedule self with backoff
    (15s, 30s, 60s, 60s, 60s, …; cap 60s; give up after 15 min → `failed`
    with `errorMessage: "timeout after 15m"`).
  - If `failed`/`cancelled`/`expired`: write `errorMessage = response.error
    ?? <status>`, flip to `failed`.
  - If `completed`:
    - Fetch video bytes: `GET https://openrouter.ai/api/v1/videos/{jobId}/content?index=0`
      with Bearer auth (raw `application/octet-stream`, **not** the
      `unsigned_urls` — those may expire).
    - `await ctx.storage.store(new Blob([bytes], { type: "video/mp4" }))`.
    - Persist `videoStorageId`, `providerUrl = response.unsigned_urls?.[0]`
      (for audit only), `costUsd = response.usage?.cost`, `tokenCount`
      (compute from `H*W*duration*24/1024`).
    - Flip to `ready`.
- [ ] `query listTopicVideos({ topicId })` — returns rows for the current
      user + topic, newest first, with resolved storage URLs.
- [ ] `query getTopicVideo({ videoId })` — single-row poll for the UI.

### Cron sweep (safety net)

- [ ] Add entry in [convex/crons.ts](stitch-app/convex/crons.ts) that runs
      every 5 min and fails any job stuck in `running` for > 20 min
      (belt-and-suspenders against dropped polls).

---

## Step 4 — Frontend (TopicDetail)

Touch [src/pages/TopicDetail.jsx](stitch-app/src/pages/TopicDetail.jsx) only.

- [ ] New component `TopicVideoPanel.jsx` under `src/components/`.
  - Props: `topicId`, `conceptKey?`.
  - Subscribes via `useQuery(api.videos.listTopicVideos, { topicId })`.
  - `useMutation(api.videos.requestTopicVideo)` behind a primary button
    "Generate explainer video".
  - Renders the latest row's state: `pending` → spinner + "Queued",
    `running` → progress message + elapsed time, `ready` → inline
    `<video controls>` using the resolved storage URL, `failed` →
    error message + "Try again".
  - Empty state: "Turn this concept into a 5-second video."
- [ ] Feature flag: only render the panel when
      `import.meta.env.VITE_VIDEO_GEN_ENABLED === "true"`. Staging build
      sets this; production build does not.
- [ ] Insert the panel into TopicDetail's right-rail stack, below
      `TopicNotesPanel`, above chat. Keep layout change surgical.

---

## Step 5 — Env & config

- [ ] Vercel (Staging project only):
  - `OPENROUTER_VIDEO_API_KEY` — server-side (Convex reads it, not Vercel,
    but set here too if an `api/` proxy is needed).
  - `VITE_VIDEO_GEN_ENABLED=true` — Preview + Staging scopes.
- [ ] Convex (staging deployment only):
  - `OPENROUTER_VIDEO_API_KEY`
  - `VIDEO_GEN_ENABLED=true`
  - `MAX_CONCURRENT_VIDEO_JOBS=5`
  - `VIDEO_DEFAULT_DURATION=5`
  - `VIDEO_DEFAULT_WIDTH=720`
  - `VIDEO_DEFAULT_HEIGHT=1280`
- [ ] Production: leave all of the above unset so the mutation's
      `FEATURE_DISABLED` guard trips if anything leaks.

---

## Step 6 — Safety, observability, rollout

- [ ] Log every provider call through the same pattern as existing
      `llmUsage` logging so we can see cost per job
      ([convex/llmUsage.ts](stitch-app/convex/llmUsage.ts)).
- [ ] Sentry: tag spans `video.generate` with `videoId`, `topicId`,
      `status`. Add a breadcrumb on each state transition.
- [ ] Add a Convex admin query `getVideoGenerationStats` (last 24h:
      count, total cost, failure rate) — gated to admin users per
      [convex/admin.ts](stitch-app/convex/admin.ts) patterns.
- [ ] Kill-switch: a single Convex env var `VIDEO_GEN_ENABLED=false`
      must disable creation immediately (no redeploy).

---

## Step 7 — Verification plan

- [ ] Unit-level: Convex type-check passes; `npm run lint` clean.
- [ ] Local: `npm run build` succeeds.
- [ ] Staging deploy:
  - [ ] Click "Generate explainer video" on a real topic → row transitions
        pending → running → ready within 2 min.
  - [ ] Video plays back from Convex storage URL (not provider URL).
  - [ ] Second click while one is running is rejected cleanly.
  - [ ] Force-failure test: set `OPENROUTER_VIDEO_API_KEY` to garbage in
        Convex staging env → row flips to `failed` with readable message.
  - [ ] Cost check: `getVideoGenerationStats` matches OpenRouter dashboard
        within rounding.
  - [ ] Production build does not render the button (feature flag off).
- [ ] Staff-engineer review prompt: "Would a staff engineer approve this?"
      Re-read before opening PR.

---

## Out of scope for this PR

- Image-to-video / reference-image support (Seedance supports it — add later).
- Concept-level granularity beyond "latest video per topic".
- User-facing credit / quota system (staging has none; prod decision deferred).
- Captions, narration, TTS overlay.
- Sharing / download UX.

---

## Resolved questions

1. **Separate endpoint.** `POST /api/v1/videos` (not `/chat/completions`).
2. **Polling URL** is returned absolute in the submit response as
   `polling_url`, and equals `GET /api/v1/videos/{id}`.
3. **Output URL TTL** is not documented. We'll always rehost via the
   authenticated `/content` endpoint into Convex storage — removes the
   TTL question entirely.
4. **Cost** comes back in `usage.cost` (USD) on the completed response.
   Token count we compute locally from the pricing formula as a
   cross-check.
