## Concept Practice Phase 1

### Scope

Hard cut over the old single-item `Study Concepts` flow into a staged `Concept Practice`
session flow on `staging` first. Phase 1 keeps grounded cloze generation, but changes the
experience from one disposable exercise into a five-item session with per-item feedback and
an end-of-session summary.

### File-by-File Engineering Tasks

#### `/private/tmp/stitch-concept-phase1/stitch-app/src/pages/TopicDetail.jsx`
- Change the practice CTA from `/dashboard/concept-intro/:topicId` to
  `/dashboard/concept/:topicId`.
- Rename the CTA label from `Study Concepts` to `Concept Practice`.
- Keep the exam CTAs untouched.

#### `/private/tmp/stitch-concept-phase1/stitch-app/src/pages/ConceptIntro.jsx`
- Remove the old intro-screen experience from the primary flow.
- Convert the page into a redirect shell so stale links to
  `/dashboard/concept-intro/:topicId` land on `/dashboard/concept/:topicId`.
- Send `/dashboard/concept-intro` without a topic back to `/dashboard`.

#### `/private/tmp/stitch-concept-phase1/stitch-app/src/pages/ConceptBuilder.jsx`
- Replace the one-item exercise flow with a five-item session player.
- Load a full concept session from Convex instead of calling the old
  `ai.generateConceptExerciseForTopic` action directly.
- Show per-item answer checking, supporting evidence quotes, and next-item progression.
- Save one session attempt at the end instead of one attempt per item.
- Add a session summary with retry, topic return, and exam-start CTAs.

#### `/private/tmp/stitch-concept-phase1/stitch-app/convex/concepts.ts`
- Add an internal query to read stored concept exercises by topic.
- Add a public action to assemble a five-item concept session using stored bank items first
  and grounded generation as fallback.
- Add a session-attempt mutation that stores a richer answers payload for the full session.
- Keep existing attempt history readable so old and new concept attempts can coexist during
  the staging cutover.

#### `/private/tmp/stitch-concept-phase1/stitch-app/convex/lib/conceptSessionSelection.js`
- Add pure selection logic for:
  - deduplicating stored concept exercises
  - extracting attempted exercise keys from legacy and session-style attempts
  - selecting unseen exercises first for a session
- Keep it framework-free so it can be regression-tested with a plain Node script.

#### `/private/tmp/stitch-concept-phase1/stitch-app/src/App.jsx`
- Keep the `/dashboard/concept/:topicId` route as the primary entry point.
- Leave `/dashboard/concept-intro/:topicId` mounted only as a redirect shell during the
  cutover.

#### `/private/tmp/stitch-concept-phase1/stitch-app/scripts/concept-session-selection-regression.test.mjs`
- Verify dedupe and unseen-first session selection logic.
- Verify legacy single-item attempts and new session attempts both suppress repeats.

#### `/private/tmp/stitch-concept-phase1/stitch-app/scripts/concept-phase1-cutover-regression.test.mjs`
- Verify the topic CTA points to `/dashboard/concept/:topicId`.
- Verify `ConceptIntro` redirects into the builder route.
- Verify `ConceptBuilder` calls the new session endpoints and renders session-summary copy.

#### `/private/tmp/stitch-concept-phase1/stitch-app/scripts/prod-concept-retake-check.mjs`
- Update the smoke path so it opens the new concept route directly.
- Update button expectations from `New Exercise` to the session flow controls.

### Validation Plan

- Run `node scripts/concept-session-selection-regression.test.mjs`
- Run `node scripts/concept-phase1-cutover-regression.test.mjs`
- Run `npx convex codegen`
- Run targeted lint/build checks for the concept flow before pushing the staging branch
