---
name: qa-stitch-app
description: >
  QA tests for the stitch-app web application, covering auth, onboarding,
  uploads, study flows, premium features, community, and admin checks.
---

# QA for stitch-app

## Testing Target

### PR / diff validation

Use the checked-out branch code locally.

1. Install deps: `npm install --prefix stitch-app`
2. Start the app: `npm run dev --prefix stitch-app -- --host 127.0.0.1 --port 5173`
3. Poll `http://127.0.0.1:5173` until it responds
4. Run browser QA against `http://127.0.0.1:5173`

Do **not** fall back to staging or production when validating a PR branch. This repo has Vercel staging-preview conventions, but no PR preview workflow was detected.

### Manual smoke against a configured environment

If the user explicitly requests smoke testing against `development`, `staging`, or `production`, use the matching URL from `.factory/skills/qa/config.yaml`.

## Authentication in CI

The app uses Better Auth + Convex with email/password and optional Google OAuth.

Expected env vars:

- `QA_LEARNER_EMAIL`
- `QA_PREMIUM_EMAIL`
- `QA_DEFAULT_TEST_PASSWORD`
- `QA_ADMIN_EMAIL`
- `QA_ADMIN_PASSWORD`
- `QA_GOOGLE_TEST_EMAIL`
- `QA_GOOGLE_TEST_PASSWORD`

Use env-provided credentials; do not wait for a human to type them in.

## App-Specific Notes

- Auth/session handoff can take a few seconds after sign-in because Better Auth and Convex must sync.
- If `VITE_CONVEX_URL` is missing in a built deployment, the app may show an auth-not-configured preview state.
- Upload flows can depend on Docling-backed extraction and Convex background processing.
- Podcasts are gated by `VITE_PODCAST_GEN_ENABLED`.
- Payment flows can run through Paystack or a manual fallback provider.
- Admin positive flows are **manual only** until an allowlisted admin account is provided.

## Flow Menu

### AUTH_PUBLIC_EMAIL_PASSWORD

Verify:

- landing page loads
- email/password signup or login works
- logout works
- forgot/reset password is reachable when inbox verification is in scope

### AUTH_GOOGLE_OAUTH

Verify:

- Google sign-in button is visible when configured
- OAuth redirect/login succeeds with the dedicated Google test account
- the user lands in the expected post-auth route

### ONBOARDING_STEPS

Verify:

- name, level, and department onboarding steps render
- validation errors show correctly
- completed onboarding redirects to `/dashboard`

### UPLOAD_PROCESSING_PIPELINE

Verify:

- learner can upload a supported file
- processing route appears
- course and topic surfaces populate
- community auto-join side effect does not break the flow

### TOPIC_STUDY_SURFACES

Verify:

- topic page loads
- re-explain/chat/source/notes surfaces open
- voice mode toggles correctly when premium access exists
- podcast panel appears only when enabled

### EXAM_AND_RESULTS

Verify:

- exam can start from the relevant entry point
- attempt state progresses correctly
- submit works
- results page renders expected feedback

### CONCEPT_PRACTICE

Verify:

- concept intro / practice route opens
- the session loads
- answers submit and completion state appears

### COMMUNITY

Verify:

- community list loads
- a learner can open a channel
- post/reply actions work when in scope

### SUBSCRIPTION_PAYSTACK_TOPUP

Verify:

- paywall routing lands on `/subscription`
- sandbox checkout init works
- callback/verification returns the learner to the app with updated entitlement state

### PROFILE_AND_PREFERENCES

Verify:

- profile loads
- dark mode / voice mode / email preferences update
- subscription summary matches the active persona

### ADMIN_MANUAL

Manual-only positive flow.

Verify:

- allowlisted admin can open `/admin`
- payment provider controls render
- admin email management renders
- cleanup actions can be carried out after write-heavy QA runs

Also include a learner negative test that `/admin` is inaccessible.

## Persona Variations

### learner

- Run auth, onboarding, upload, study, exam, community, and profile flows
- Negative tests:
  - `/admin` blocked
  - premium-only surfaces blocked or upsold after free limits

### premium

- Run learner baseline plus subscription/top-up, voice, podcasts, humanizer, and premium AI flows
- Negative tests:
  - admin-only controls blocked

### admin

- Manual-only positive admin validation
- Use for cleanup after QA-created writes

## Error Handling

- If auth is still syncing, wait briefly and retry once before reporting BLOCKED.
- If Google OAuth credentials are missing, report the OAuth flow BLOCKED and continue with email/password coverage.
- If a feature flag disables a flow in the chosen environment, report that flow BLOCKED with the missing flag name.
- If Paystack is in manual mode, report sandbox payment execution BLOCKED and verify the manual fallback UI instead.

## Known Failure Modes

1. **Better Auth / Convex session sync lag.** Immediately after login, uploads or exam starts can fail with session-not-ready messaging. Wait a few seconds and retry once before treating it as a product bug.
2. **Preview auth not configured.** If a deployment lacks `VITE_CONVEX_URL`, auth surfaces can render a preview-not-configured fallback instead of a working session.
3. **Podcast panel hidden by flag.** `VITE_PODCAST_GEN_ENABLED` must be true or podcast coverage is not testable.
4. **Doc extraction dependency chain.** Upload processing can block if the Convex environment is missing Docling configuration or the extraction service is unavailable.
5. **Payment provider may not be Paystack.** Admin settings can switch the app to `manual`, so sandbox checkout may be unavailable even though the subscription page still renders.
6. **Admin flows require an allowlisted account.** Positive `/admin` checks should be marked BLOCKED unless `QA_ADMIN_EMAIL` maps to a real admin user.
