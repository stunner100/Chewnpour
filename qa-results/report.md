## QA Report

| # | Test Case | App | Persona | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Factory hosted QA harness execution | repo | n/a | :no_entry: BLOCKED | `droid` is installed, but `FACTORY_API_KEY` and QA persona env vars are not exported in this shell. `droid exec` produced no report/output and was stopped. |
| 2 | Local branch route smoke | stitch-app | unauthenticated | :x: FAIL | 0/40 routes were clean because every route hit Better Auth/Convex CORS errors from `http://127.0.0.1:5173` to `https://patient-anteater-364.convex.site/api/auth/get-session`. Local PR validation is currently blocked by auth origin configuration. |
| 3 | Production public/protected route smoke | stitch-app | unauthenticated | :warning: FLAKY | 18/40 routes were clean. Public pages and protected redirects loaded, but many protected redirects logged aborted `/api/sentry-tunnel` requests during navigation teardown. No app crash observed. |
| 4 | Production dashboard shell | stitch-app | learner | :warning: FLAKY | Dashboard rendered and navigation/sidebar loaded, but PostHog feature flag request is blocked by CORS in the browser console. |
| 5 | Production owned course page | stitch-app | learner | :white_check_mark: PASS | Owned Photosynthesis course rendered with 6 topics and course actions. |
| 6 | Production owned topic study entry | stitch-app | learner | :white_check_mark: PASS | Owned course `Start topic` opened the topic study-mode chooser, then Practice Only opened the lesson/practice surface. |
| 7 | Production objective quiz startup | stitch-app | learner | :white_check_mark: PASS | Objective quiz started for owned topic and rendered a 5-question exam with examinable options. |
| 8 | Production processing redirect for recovered upload | stitch-app | learner | :white_check_mark: PASS | Processing URL for `jh74gxnkb2t55cjhg9677gascd85y89c` redirected to the ready course page. |
| 9 | Production direct course authorization consistency | stitch-app | learner | :x: FAIL | Direct URL to Mathematical Logic course rendered a full course page even though it was not listed in the signed-in learner dashboard; clicking its topic links then showed “This topic link is stale.” This is an authorization/ownership consistency bug. |
| 10 | Learner admin negative access | stitch-app | learner | :white_check_mark: PASS | `/admin` shows “Admin access required” for non-admin learner. |
| 11 | Local Docling health | docling-service | n/a | :white_check_mark: PASS | `GET /health` returned `200 {"status":"ok"}`. |
| 12 | Local Docling empty upload validation | docling-service | n/a | :white_check_mark: PASS | Empty multipart upload returned `400 {"detail":"Uploaded file is empty."}`. |
| 13 | Local Docling sample PDF extraction | docling-service | n/a | :x: FAIL | One-page extraction of `stitch-app/Channel Ideas Without Remotion.pdf` returned `500` after about 70s: `Docling conversion returned empty markdown.` |
| 14 | Secret-backed remote Docling, Google OAuth, premium, Paystack, admin positive cleanup | multiple | multiple | :no_entry: BLOCKED | Required QA env vars were not available locally: QA account credentials, Google test credentials, Docling URL/secret, admin credentials, and Factory API key. |

### Action Required

- Fix local dev auth CORS or point local branch QA at a Convex/Better Auth deployment that allows `http://127.0.0.1:5173`; otherwise the Factory QA workflow’s documented local-dev strategy will fail every PR.
- Fix course/topic ownership consistency: a learner should not see another user’s course by direct URL, or the topic authorization should match the course authorization. Current behavior leaks the course shell and then blocks topics as stale.
- Investigate Docling empty-markdown failures. The app fallback prevents uploads from getting stuck, but Docling itself still fails on representative PDFs.
- Decide whether `/api/sentry-tunnel` aborts and PostHog CORS should be filtered as harmless telemetry noise or fixed in production configuration.
- Export the QA secrets locally or rely on GitHub Actions secrets before expecting full Factory-hosted persona coverage.

<details>
<summary>Screenshots & Evidence</summary>

- Factory skill files used: `.factory/skills/qa/SKILL.md`, `.factory/skills/qa-stitch-app/SKILL.md`, `.factory/skills/qa-docling-service/SKILL.md`.
- Local route smoke command: `SMOKE_BASE_URL=http://127.0.0.1:5173 node scripts/qa-route-smoke.mjs`.
- Local route smoke result: `0/40 clean`; repeated CORS error against `https://patient-anteater-364.convex.site/api/auth/get-session`.
- Production route smoke command: `SMOKE_BASE_URL=https://www.chewnpour.com node scripts/qa-route-smoke.mjs`.
- Production route smoke result: `18/40 clean`; failures were aborted `/api/sentry-tunnel` requests during protected-route redirects.
- Course evidence: `qa-results/course-main-snapshot.md`.
- Recovered processing redirect evidence: `qa-results/processing-redirect-snapshot.md`.
- Cross-user/stale topic evidence: `qa-results/topic-click-result-snapshot.md`.
- Owned course evidence: `qa-results/owned-course-snapshot.md`.
- Owned topic evidence: `qa-results/owned-topic-snapshot.md`.
- Objective quiz evidence: `qa-results/objective-quiz-start-snapshot.md`.
- Admin negative evidence: `qa-results/admin-negative-snapshot.md`.
- Docling health response: `HTTP/1.1 200 OK {"status":"ok"}`.
- Docling empty upload response: `HTTP/1.1 400 Bad Request {"detail":"Uploaded file is empty."}`.
- Docling sample extraction response: `HTTP/1.1 500 Internal Server Error {"detail":"Docling extract error: Docling conversion returned empty markdown."}`.

</details>
