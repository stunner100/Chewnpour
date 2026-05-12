# Security Findings Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding in the Codex Security report by making authorization server-derived, removing public dangerous legacy functions, hardening Docling, patching dependencies, rotating local secrets, and adding browser security headers.

**Architecture:** Make Convex authz centralized and explicit: public functions derive the current user from `ctx.auth`, internal/server workflows call `internal.*` helpers, and user-supplied ids are treated only as object selectors that must be owner-checked. Fix high-impact P0/P1 findings first, then service hardening, dependency hygiene, and browser headers.

**Tech Stack:** React + Vite, Convex TypeScript functions, Better Auth, Node regression scripts, FastAPI/Python Docling service, Vercel headers.

---

## Source Reports

- Final scan report: `/tmp/codex-security-scans/chewnpour/cfb8519e433e_20260511T114607Z/report.md`
- Validation artifacts: `/tmp/codex-security-scans/chewnpour/cfb8519e433e_20260511T114607Z/artifacts`

## File Structure

- Create `stitch-app/convex/lib/authz.ts`: shared Convex auth and owner-check helpers.
- Create `stitch-app/scripts/security-convex-authz-regression.test.mjs`: static regression coverage proving public functions derive auth, dangerous legacy exports are gone, and backend-only helpers are internal.
- Modify `stitch-app/convex/courses.ts`: remove client `userId` trust, add internal course helpers, owner-check reads/writes/deletes.
- Modify `stitch-app/convex/uploads.ts`: owner-check reads/deletes, make backend status updates internal.
- Modify `stitch-app/convex/assignments.ts`: derive user from auth for public thread operations, add internal helpers for AI assignment workflows.
- Modify `stitch-app/convex/courseFolders.ts`: derive user from auth and owner-check folder/course moves.
- Modify `stitch-app/convex/profiles.ts`: derive user from auth for profile updates/referral operations; keep token unsubscribe anonymous.
- Modify `stitch-app/convex/community.ts`: derive user from auth for membership/post/flag writes; public reads return only safe public profile fields.
- Modify `stitch-app/convex/topicChat.ts`: make assistant insertion internal and keep user send/clear auth-bound.
- Modify `stitch-app/convex/topics.ts`: owner-check public topic reads/writes, make generation-only topic creation/update helpers internal.
- Modify `stitch-app/convex/subscriptions.ts`: remove public legacy subscription writes and make quota consumption internal/auth-bound.
- Modify `stitch-app/convex/devAuth.ts`: remove the public deletion mutation, or delete the file if no import remains.
- Modify `stitch-app/convex/extraction.ts`, `stitch-app/convex/ai.ts`, `stitch-app/convex/grounded.ts`, and related callers: replace public helper calls with `internal.*` calls.
- Modify React callsites under `stitch-app/src`: stop sending `userId` into functions that can derive it from auth.
- Modify `docling-service/render_api/app.py` and `docling-service/tests/test_render_api_docling.py`: fail closed on missing secret and enforce upload size before conversion.
- Modify `stitch-app/convex/extraction.ts` and optionally `stitch-app/convex/admin.ts`: remove public smoke extraction or wrap it behind admin access.
- Modify `stitch-app/package.json` and `stitch-app/package-lock.json`: update vulnerable production dependency chain.
- Modify `stitch-app/vercel.json` and optionally `stitch-app/index.html`: add browser security headers without breaking app bootstrap.
- Modify `stitch-app/.env.example`: keep placeholders aligned with required secret names.

## Task 1: Add Convex Authz Helper And Regression Harness

**Files:**
- Create: `stitch-app/convex/lib/authz.ts`
- Create: `stitch-app/scripts/security-convex-authz-regression.test.mjs`

- [ ] **Step 1: Add failing regression script**

Create `stitch-app/scripts/security-convex-authz-regression.test.mjs` with checks for the broken public patterns:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const forbiddenPublicExports = [
  ["convex/devAuth.ts", /export\s+const\s+devDeleteUserByEmail\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+upgradeToPremium\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+upsertSubscription\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+cancelSubscription\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeAiMessageCreditOrThrow\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeVoiceGenerationCreditOrThrow\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeReExplainCreditOrThrow\s*=\s*mutation\(/],
  ["convex/subscriptions.ts", /export\s+const\s+consumeHumanizerCreditOrThrow\s*=\s*mutation\(/],
  ["convex/extraction.ts", /export\s+const\s+smokeDoclingExtraction\s*=\s*action\(/],
  ["convex/topicChat.ts", /export\s+const\s+appendAssistantMessage\s*=\s*mutation\(/],
  ["convex/uploads.ts", /export\s+const\s+updateUploadStatus\s*=\s*mutation\(/],
];

for (const [file, pattern] of forbiddenPublicExports) {
  assert.equal(pattern.test(read(file)), false, `${file} still exposes a public dangerous function`);
}

const authzSource = read("convex/lib/authz.ts");
for (const snippet of [
  "export const requireAuthenticatedUserId",
  "export const assertOwnerUserId",
  "export const getAuthenticatedUserIdOrNull",
  "collectAuthUserIdCandidates",
]) {
  assert.ok(authzSource.includes(snippet), `authz helper missing ${snippet}`);
}

const publicUserIdArgChecks = [
  ["convex/courses.ts", /userId:\s*v\.string\(\)/],
  ["convex/uploads.ts", /args:\s*\{\s*userId:/],
  ["convex/assignments.ts", /userId:\s*v\.string\(\)/],
  ["convex/courseFolders.ts", /userId:\s*v\.string\(\)/],
  ["convex/community.ts", /userId:\s*v\.string\(\)/],
];

for (const [file, pattern] of publicUserIdArgChecks) {
  assert.equal(pattern.test(read(file)), false, `${file} still accepts userId as public authority`);
}

console.log("security-convex-authz-regression.test.mjs passed");
```

- [ ] **Step 2: Run regression and verify it fails**

Run:

```bash
cd stitch-app && node scripts/security-convex-authz-regression.test.mjs
```

Expected: FAIL because `convex/lib/authz.ts` does not exist yet and dangerous public exports still exist.

- [ ] **Step 3: Add shared authz helper**

Create `stitch-app/convex/lib/authz.ts`:

```ts
import { ConvexError } from "convex/values";
import { collectAuthUserIdCandidates, resolveAuthUserId } from "./examSecurity";

export const getAuthenticatedUserIdOrNull = async (ctx: any): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity().catch(() => null);
    const userId = resolveAuthUserId(identity);
    return userId || null;
};

export const requireAuthenticatedUserId = async (ctx: any): Promise<string> => {
    const userId = await getAuthenticatedUserIdOrNull(ctx);
    if (!userId) {
        throw new ConvexError({
            code: "UNAUTHENTICATED",
            message: "You must be signed in.",
        });
    }
    return userId;
};

export const getAuthenticatedUserIdCandidates = async (ctx: any): Promise<string[]> => {
    const identity = await ctx.auth.getUserIdentity().catch(() => null);
    return collectAuthUserIdCandidates(identity);
};

export const assertOwnerUserId = (args: {
    authenticatedUserId: string;
    ownerUserId?: string | null;
    message?: string;
}) => {
    const ownerUserId = String(args.ownerUserId || "").trim();
    if (!ownerUserId || ownerUserId !== args.authenticatedUserId) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: args.message || "You do not have permission to access this resource.",
        });
    }
};
```

- [ ] **Step 4: Run regression and verify remaining failures**

Run:

```bash
cd stitch-app && node scripts/security-convex-authz-regression.test.mjs
```

Expected: FAIL only on existing public function patterns.

- [ ] **Step 5: Commit Task 1**

Run after Task 1 passes its intended partial checks:

```bash
git add stitch-app/convex/lib/authz.ts stitch-app/scripts/security-convex-authz-regression.test.mjs
git commit -m "Add security authz regression harness"
```

## Task 2: Fix Course, Upload, Assignment, Folder, Topic, Profile, Community, And Chat Authz

**Files:**
- Modify: `stitch-app/convex/courses.ts`
- Modify: `stitch-app/convex/uploads.ts`
- Modify: `stitch-app/convex/assignments.ts`
- Modify: `stitch-app/convex/courseFolders.ts`
- Modify: `stitch-app/convex/profiles.ts`
- Modify: `stitch-app/convex/community.ts`
- Modify: `stitch-app/convex/topicChat.ts`
- Modify: `stitch-app/convex/topics.ts`
- Modify: relevant callers in `stitch-app/src`
- Modify: internal callers in `stitch-app/convex/ai.ts`, `stitch-app/convex/extraction.ts`, `stitch-app/convex/grounded.ts`

- [ ] **Step 1: Update public reads to derive user from auth**

Use this pattern for user-list functions:

```ts
import { requireAuthenticatedUserId, assertOwnerUserId } from "./lib/authz";

export const getUserCourses = query({
    args: {},
    handler: async (ctx) => {
        const userId = await requireAuthenticatedUserId(ctx);
        return await ctx.db
            .query("courses")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();
    },
});
```

Apply the same no-`userId` public signature to:

- `courses.getUserCourses`
- `uploads.getUserUploads`
- `assignments.listThreads`
- `courseFolders.listFolders`
- `profiles.getUserStats`
- `profiles.getReferralStats`
- `community.getUserChannels`

- [ ] **Step 2: Update object reads to fetch owner and assert**

Use this pattern for object-id reads:

```ts
export const getUpload = query({
    args: { uploadId: v.id("uploads") },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const upload = await ctx.db.get(args.uploadId);
        if (!upload) return null;
        assertOwnerUserId({ authenticatedUserId: userId, ownerUserId: upload.userId });
        return upload;
    },
});
```

Apply equivalent owner checks to:

- `courses.getCourseWithTopics`
- `courses.getCourseSources`
- `assignments.getThreadWithMessages`
- `topics.getTopicsByCourse`
- `topics.getQuestionsByTopic`
- `topics.unlockTopic`
- `topics.getTopicSourcePassages` if it reads topic/course data

- [ ] **Step 3: Convert public writes to auth-derived writes**

Use this pattern for create/update/delete functions:

```ts
export const createCourse = mutation({
    args: {
        title: v.string(),
        description: v.optional(v.string()),
        coverColor: v.optional(v.string()),
        uploadId: v.optional(v.id("uploads")),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        if (args.uploadId) {
            const upload = await ctx.db.get(args.uploadId);
            assertOwnerUserId({ authenticatedUserId: userId, ownerUserId: upload?.userId });
        }
        return await ctx.db.insert("courses", {
            userId,
            title: args.title,
            description: args.description,
            coverColor: args.coverColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            uploadId: args.uploadId,
            progress: 0,
            status: "in_progress",
        });
    },
});
```

Apply equivalent auth-derived writes to:

- `courses.createCourse`, `courses.deleteCourse`, `courses.addUploadToCourse`, `courses.removeSourceFromCourse`
- `uploads.createUpload`, `uploads.deleteUpload`
- `assignments.createThreadFromUpload`, `assignments.renameThread`, `assignments.deleteThread`, `assignments.appendMessage`
- `courseFolders.createFolder`, `renameFolder`, `deleteFolder`, `moveCourseToFolder`
- `profiles.upsertProfile`, `updateStreak`, `addStudyTime`, `touchPresence`, `ensureReferralCode`, `setReferredBy`, `applyReferralCredit`
- `community.createChannelForCourse`, `joinChannel`, `leaveChannel`, `createPost`, `flagPost`, `autoJoinOnUpload`, `joinSeededChannels`

- [ ] **Step 4: Make server-only helpers internal**

Replace public helper exports with internal versions:

```ts
import { internalMutation } from "./_generated/server";

export const updateUploadStatusInternal = internalMutation({
    args: {
        uploadId: v.id("uploads"),
        status: v.optional(v.string()),
        processingStep: v.optional(v.string()),
        processingProgress: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { uploadId, ...updates } = args;
        await ctx.db.patch(uploadId, Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined)
        ));
    },
});
```

Then update callers:

```ts
await ctx.runMutation(internal.uploads.updateUploadStatusInternal, {
    uploadId,
    status: "processing",
});
```

Do this for:

- `uploads.updateUploadStatus`
- `courses.updateCourse`
- `courses.updateCourseProgress` if only server workflows use it
- `topicChat.appendAssistantMessage`
- generation-only topic creation/update helpers that are not user-facing

- [ ] **Step 5: Update frontend callsites to stop passing `userId`**

For each changed public function, update React calls from:

```js
const courses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');
await deleteCourse({ courseId: course._id, userId });
```

to:

```js
const courses = useQuery(api.courses.getUserCourses, isConvexAuthenticated ? {} : 'skip');
await deleteCourse({ courseId: course._id });
```

Must update at minimum:

- `stitch-app/src/pages/DashboardAnalysis.jsx`
- `stitch-app/src/pages/DashboardCourse.jsx`
- `stitch-app/src/pages/DashboardProcessing.jsx`
- `stitch-app/src/pages/DashboardPodcasts.jsx`
- `stitch-app/src/pages/AssignmentHelper.jsx`
- `stitch-app/src/components/course/SourceFileCard.jsx`
- `stitch-app/src/components/StatsDetailModal.jsx`
- `stitch-app/src/pages/Community.jsx`
- `stitch-app/src/pages/CommunityChannel.jsx`
- `stitch-app/src/pages/Profile.jsx`

- [ ] **Step 6: Run targeted auth regression**

Run:

```bash
cd stitch-app && node scripts/security-convex-authz-regression.test.mjs
```

Expected: PASS for the public-authz patterns covered by the script.

- [ ] **Step 7: Run existing auth and topic regression scripts**

Run:

```bash
cd stitch-app
node scripts/topic-auth-transition-regression.test.mjs
node scripts/exam-security-regression.test.mjs
node scripts/concept-auth-hardening-regression.test.mjs
node scripts/upload-quota-auth-gating-regression.test.mjs
node scripts/ai-message-quota-regression.test.mjs
```

Expected: all PASS.

- [ ] **Step 8: Run lint**

Run:

```bash
cd stitch-app && npm run lint
```

Expected: PASS.

- [ ] **Step 9: Regenerate Convex API outputs if signatures changed**

Run:

```bash
cd stitch-app && npx convex dev --once
```

Expected: generated API reflects removed public functions and added internal helpers. Do not hand-edit `stitch-app/convex/_generated/`.

- [ ] **Step 10: Commit Task 2**

Run:

```bash
git add stitch-app/convex stitch-app/src stitch-app/scripts
git commit -m "Harden Convex user object authorization"
```

## Task 3: Remove Legacy Billing And Dev Deletion Surfaces

**Files:**
- Modify: `stitch-app/convex/subscriptions.ts`
- Modify or delete: `stitch-app/convex/devAuth.ts`
- Modify: `stitch-app/scripts/security-convex-authz-regression.test.mjs`

- [ ] **Step 1: Delete public legacy subscription writers**

Remove these exports entirely:

```ts
export const upsertSubscription = mutation(...)
export const upgradeToPremium = mutation(...)
export const cancelSubscription = mutation(...)
```

If admin-only replacements are still needed, create explicit admin wrappers in `stitch-app/convex/admin.ts` using `requireAdminAccess`; do not keep public compatibility names.

- [ ] **Step 2: Make quota consumption internal**

Change public quota mutations to internal mutations:

```ts
export const consumeAiMessageCreditOrThrowInternal = internalMutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userId = String(args.userId || "").trim();
        if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED", message: "You must be signed in." });
        return await consumeAiMessageCreditForUser(ctx, userId);
    },
});
```

Use small shared private helpers for the existing quota logic so callsites can move from `api.subscriptions.consumeAiMessageCreditOrThrow` to `internal.subscriptions.consumeAiMessageCreditOrThrowInternal`.

- [ ] **Step 3: Remove dev account deletion**

Delete `stitch-app/convex/devAuth.ts` if no test import exists. If Convex requires the module to remain, leave only:

```ts
export {};
```

- [ ] **Step 4: Update callers**

Replace all public quota calls:

```ts
await ctx.runMutation(api.subscriptions.consumeAiMessageCreditOrThrow, { userId });
```

with:

```ts
await ctx.runMutation(internal.subscriptions.consumeAiMessageCreditOrThrowInternal, { userId });
```

Repeat for voice generation, re-explain, and humanizer quotas.

- [ ] **Step 5: Test billing/dev-surface removal**

Run:

```bash
cd stitch-app
node scripts/security-convex-authz-regression.test.mjs
npm run lint
npx convex dev --once
```

Expected: regression and lint pass; generated API no longer exposes deleted public functions.

- [ ] **Step 6: Commit Task 3**

```bash
git add stitch-app/convex stitch-app/scripts
git commit -m "Remove public legacy billing and dev auth surfaces"
```

## Task 4: Harden Docling API And Smoke Extraction

**Files:**
- Modify: `docling-service/render_api/app.py`
- Modify: `docling-service/tests/test_render_api_docling.py`
- Modify: `stitch-app/convex/extraction.ts`
- Modify: `stitch-app/convex/admin.ts` if keeping an admin smoke wrapper

- [ ] **Step 1: Add Docling tests for fail-closed auth and size limit**

Add tests to `docling-service/tests/test_render_api_docling.py`:

```py
from fastapi.testclient import TestClient

from render_api import app as render_app


def test_extract_requires_configured_shared_secret(monkeypatch):
    monkeypatch.setattr(render_app, "DOCLING_SHARED_SECRET", "")
    client = TestClient(render_app.app)
    response = client.post(
        "/extract",
        data={"contentType": "application/pdf", "profile": "enhanced_pdf"},
        files={"file": ("sample.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 503


def test_extract_rejects_oversized_upload_before_conversion(monkeypatch):
    monkeypatch.setattr(render_app, "DOCLING_SHARED_SECRET", "secret")
    monkeypatch.setattr(render_app, "MAX_UPLOAD_BYTES", 4)
    client = TestClient(render_app.app)
    response = client.post(
        "/extract",
        headers={"x-docling-shared-secret": "secret"},
        data={"contentType": "application/pdf", "profile": "enhanced_pdf"},
        files={"file": ("sample.pdf", b"12345", "application/pdf")},
    )
    assert response.status_code == 413
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd docling-service && pytest tests/test_render_api_docling.py -q
```

Expected: FAIL because the service currently fails open and has no upload limit.

- [ ] **Step 3: Implement Docling fail-closed auth and upload limit**

Update `docling-service/render_api/app.py`:

```py
DOCLING_SHARED_SECRET = os.getenv("DOCLING_SHARED_SECRET", "").strip()
MAX_UPLOAD_BYTES = int(os.getenv("DOCLING_MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))


def _require_shared_secret(header_value: str | None) -> None:
    if not DOCLING_SHARED_SECRET:
        raise HTTPException(status_code=503, detail="Docling shared secret is not configured.")
    if header_value != DOCLING_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid shared secret.")


async def _read_limited_upload(file: UploadFile) -> bytes:
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file is too large.")
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return payload
```

Then in `extract_document` replace the current secret check and full read with:

```py
    _require_shared_secret(x_docling_shared_secret)
    payload = await _read_limited_upload(file)
```

- [ ] **Step 4: Gate or remove public smoke extraction**

Preferred hard cutover: replace `export const smokeDoclingExtraction = action(...)` with `internalAction`:

```ts
export const smokeDoclingExtractionInternal = internalAction({
    args: {},
    handler: async () => {
        // existing body unchanged
    },
});
```

If a UI-accessible smoke test is needed, add an admin wrapper in `admin.ts`:

```ts
export const smokeDoclingExtraction = action({
    args: {},
    handler: async (ctx) => {
        const access = await ctx.runQuery(internal.admin.getAdminAccessStatusInternal, {});
        if (!access?.authUserId || !access.allowlistConfigured || !access.isAllowed) {
            throw new Error("Admin access required.");
        }
        return await ctx.runAction(internal.extraction.smokeDoclingExtractionInternal, {});
    },
});
```

- [ ] **Step 5: Run tests**

```bash
cd docling-service && pytest tests/test_render_api_docling.py -q
cd ../stitch-app && node scripts/security-convex-authz-regression.test.mjs && npm run lint
```

Expected: all PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add docling-service/render_api/app.py docling-service/tests/test_render_api_docling.py stitch-app/convex/extraction.ts stitch-app/convex/admin.ts stitch-app/scripts/security-convex-authz-regression.test.mjs
git commit -m "Harden Docling extraction access"
```

## Task 5: Patch Production Dependencies

**Files:**
- Modify: `stitch-app/package.json`
- Modify: `stitch-app/package-lock.json`

- [ ] **Step 1: Capture current advisory baseline**

Run:

```bash
cd stitch-app && npm audit --omit=dev --json > /tmp/chewnpour-npm-audit-before.json || true
```

Expected: current output includes `protobufjs`, `kysely`, `defu`, and `dompurify`.

- [ ] **Step 2: Update root packages first**

Run:

```bash
cd stitch-app && npm update posthog-js @posthog/react better-auth @convex-dev/better-auth
```

Expected: `package-lock.json` changes and no source edits.

- [ ] **Step 3: Re-run audit**

Run:

```bash
cd stitch-app && npm audit --omit=dev
```

Expected: zero production vulnerabilities. If advisories remain only because upstream ranges lag, add a minimal `overrides` block after compatibility testing:

```json
{
  "overrides": {
    "protobufjs": ">=7.5.5",
    "kysely": ">=0.28.14",
    "defu": ">6.1.4",
    "dompurify": ">=3.4.0"
  }
}
```

Use exact resolved versions from npm at execution time rather than hard-coding guessed versions.

- [ ] **Step 4: Run app checks**

```bash
cd stitch-app
npm run lint
node scripts/better-auth-convex-token-regression.test.mjs
node scripts/convex-auth-provider-regression.test.mjs
node scripts/posthog-instrumentation-regression.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add stitch-app/package.json stitch-app/package-lock.json
git commit -m "Patch production dependency advisories"
```

## Task 6: Add Browser Security Headers

**Files:**
- Modify: `stitch-app/vercel.json`
- Modify: `stitch-app/index.html` if moving inline script is required
- Create or modify: `stitch-app/scripts/security-headers-regression.test.mjs`

- [ ] **Step 1: Add failing header regression**

Create `stitch-app/scripts/security-headers-regression.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const allHeaders = JSON.stringify(config.headers || []);

for (const key of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  assert.ok(allHeaders.includes(key), `Missing ${key}`);
}

assert.ok(
  /frame-ancestors\s+'none'|frame-ancestors\s+'self'/.test(allHeaders),
  "CSP must include frame-ancestors"
);

console.log("security-headers-regression.test.mjs passed");
```

- [ ] **Step 2: Run and verify failure**

```bash
cd stitch-app && node scripts/security-headers-regression.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Add headers to `vercel.json`**

Add a top-level catch-all header entry before asset cache entries:

```json
{
  "source": "/(.*)",
  "headers": [
    {
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.posthog.com https://*.sentry.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; media-src 'self' blob: https:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "Referrer-Policy",
      "value": "strict-origin-when-cross-origin"
    },
    {
      "key": "Permissions-Policy",
      "value": "camera=(), microphone=(), geolocation=(), payment=()"
    }
  ]
}
```

Keep `'unsafe-inline'` initially because `index.html` has an inline theme bootstrap script. A stricter follow-up can move that script to an external file or use a CSP hash.

- [ ] **Step 4: Run header and app checks**

```bash
cd stitch-app
node scripts/security-headers-regression.test.mjs
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add stitch-app/vercel.json stitch-app/scripts/security-headers-regression.test.mjs
git commit -m "Add browser security headers"
```

## Task 7: Rotate And Document Secrets

**Files:**
- Modify: `stitch-app/.env.example`
- Do not commit: `.env`, `.env.local`, `.env.production.local`

- [ ] **Step 1: Inventory required secret names without values**

Run:

```bash
cd stitch-app && rg -o "process\\.env\\.[A-Z0-9_]+" convex src | sed 's/.*process.env.//' | sort -u
```

Expected: list of env var names only.

- [ ] **Step 2: Update `.env.example` placeholders**

Ensure `stitch-app/.env.example` has placeholder-only entries for every required production secret:

```dotenv
# Required in production
APP_BASE_URL=
FRONTEND_URLS=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_EMAIL_FROM=
DOCLING_ENABLED=
DOCLING_EXTRACT_URL=
DOCLING_SHARED_SECRET=
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_FORWARD_SECRET=

# Public browser config; values are not secrets
VITE_CONVEX_URL=
VITE_APP_BASE_URL=
```

Do not paste real values into the example file.

- [ ] **Step 3: Rotate externally**

Rotate any value from local ignored env files that may have been copied, synced, logged, or shared. At minimum review provider dashboards for:

- Better Auth / Convex auth secrets
- Cloudflare email/API token
- Paystack secret and webhook forward secret
- AI/model provider keys
- Sentry/PostHog tokens with write access
- Docling shared secret

- [ ] **Step 4: Verify no tracked secrets**

Run:

```bash
git grep -nE "(sk_live|pk_live|secret|api[_-]?key|token|password)" -- ':!stitch-app/.env.example' ':!docs/superpowers/plans/2026-05-11-security-findings-remediation.md'
git ls-files 'stitch-app/.env*'
```

Expected: no real secret values; only `stitch-app/.env.example` is tracked among env files.

- [ ] **Step 5: Commit Task 7**

```bash
git add stitch-app/.env.example
git commit -m "Document required environment variables"
```

## Task 8: Full Verification And Push

**Files:**
- No new source files unless previous tasks revealed necessary fixes.

- [ ] **Step 1: Run full targeted security checks**

```bash
cd stitch-app
node scripts/security-convex-authz-regression.test.mjs
node scripts/security-headers-regression.test.mjs
node scripts/topic-auth-transition-regression.test.mjs
node scripts/exam-security-regression.test.mjs
node scripts/concept-auth-hardening-regression.test.mjs
node scripts/upload-quota-auth-gating-regression.test.mjs
node scripts/ai-message-quota-regression.test.mjs
npm audit --omit=dev
npm run lint
npm run build
```

Expected: all PASS and audit shows zero production vulnerabilities.

- [ ] **Step 2: Run Docling tests**

```bash
cd docling-service && pytest
```

Expected: PASS.

- [ ] **Step 3: Regenerate Convex outputs if required**

```bash
cd stitch-app && npx convex dev --once
```

Expected: generated API matches current functions. Do not hand-edit `_generated`.

- [ ] **Step 4: Re-run security scan closure**

Run a local closure review against the original report:

```bash
rg -n "devDeleteUserByEmail|upgradeToPremium|upsertSubscription|cancelSubscription|smokeDoclingExtraction\\s*=\\s*action|updateUploadStatus\\s*=\\s*mutation" stitch-app/convex --glob '!_generated/**'
cd stitch-app && npm audit --omit=dev
```

Expected: no public dangerous exports remain and audit is clean.

- [ ] **Step 5: Final commit if any verification fixes were needed**

```bash
git status --short
git add <only files changed by verification fixes>
git commit -m "Complete security remediation verification"
```

Skip this commit if there are no changes.

- [ ] **Step 6: Push**

```bash
git push origin HEAD
```

Expected: branch is pushed successfully.

## Execution Order

1. Task 1 establishes tests and shared authz helpers.
2. Task 2 closes the broad P0 cross-user data access class.
3. Task 3 closes the P0 billing and P1 dev deletion surfaces.
4. Task 4 closes Docling service and smoke extraction issues.
5. Task 5 patches dependency advisories.
6. Task 6 adds browser headers.
7. Task 7 handles secrets without committing secret values.
8. Task 8 verifies and pushes.

## Review Checkpoints

- After Task 2, manually review every remaining public Convex export that accepts `userId` or raw ids.
- After Task 3, verify `_generated/api` no longer exposes removed public dangerous functions.
- After Task 4, verify production Docling deployment has `DOCLING_SHARED_SECRET` and `DOCLING_MAX_UPLOAD_BYTES` set.
- After Task 5, verify `npm audit --omit=dev` is clean.
- After Task 6, verify the app still boots under CSP in a browser.
- After Task 7, confirm secret rotation status outside git.

## Residual Risk

- The original scan deferred full line-by-line review of `convex/ai.ts` and `convex/grounded.ts`; Task 2 updates known public-helper callsites, but a follow-up security scan should review those large files after the main authz hardening lands.
- Browser headers reduce blast radius but are not a substitute for XSS-safe rendering. Keep CSP tightening as a follow-up once inline bootstrap code is externalized or hashed.
