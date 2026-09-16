# Roadmap

This is an evidence-based, non-binding roadmap. It records work suggested by the current codebase, open pull requests, repository TODOs, existing documentation, and unfinished systems. Items labeled Proposal are not commitments or delivery dates.

## Evidence snapshot

Reviewed on 2026-09-16:

- No open GitHub issues were visible.
- Pull request [#54](https://github.com/stunner100/Chewnpour/pull/54) proposes a PWA reload prompt for installed iOS PWAs and currently has a passing QA check in the reviewed snapshot.
- Pull request [#37](https://github.com/stunner100/Chewnpour/pull/37) proposes the AnyDoc parsing cutover and has a failing QA check in the reviewed snapshot. The current master checkout already contains in-process AnyDoc imports, so the relationship between that pull request and the current baseline should be verified before further work.
- Existing task notes cover the Slate landing/dashboard redesign and historical infrastructure rehearsals.
- Several current routes intentionally render a paused-feature view. No schedule for reactivating those surfaces is recorded here.

## Current study loop

The current route and server code support uploads, generated courses and lessons, quizzes, exams, lesson-scoped tutor interactions, progress, notes, audio-related topic and podcast flows, and public lesson sharing. This describes code paths, not a guarantee that every provider-backed flow is enabled in every deployment.

## Reliability

- Proposal: verify the production behavior and merge readiness of the PWA update work in #54, including installed-app update behavior.
- Proposal: document operational recovery for upload extraction, course-generation, podcast, and study-worker jobs using the existing status, timeout, and stale-job handling.
- Proposal: reconcile the dated security report and historical task notes with the current Supabase/PostgreSQL code so stale Convex-specific risks are either retired or re-tested.

## Developer experience

- Proposal: keep package-specific setup and validation commands synchronized with package metadata and CI.
- Proposal: reconcile stitch-app/package-lock.json with stitch-app/package.json; npm ci currently reports that @types/react is missing from the lock file.
- Proposal: decide whether the repository needs a supported root orchestration command; do not add one until its package boundaries and failure behavior are agreed.
- Proposal: review the repository-local agent and skill catalog for stale instructions while preserving those directories as project assets.

## AI and tutoring systems

- Proposal: evaluate enabling grounded vector retrieval when Voyage credentials, quality checks, and operating costs are understood. The current flag is disabled by default.
- Proposal: expand source-boundary and prompt-injection regression coverage around lesson generation and tutor responses.
- Proposal: document provider selection, fallback behavior, and model-specific limits for course generation, tutor chat, embeddings, speech, and podcast generation.

## Performance

- Proposal: measure upload extraction, course generation, tutor streaming, and podcast generation against the configured serverless and provider timeouts.
- Proposal: use production-safe telemetry to identify slow or repeatedly retried jobs before changing limits or introducing background infrastructure.

## Accessibility

- Proposal: add repeatable keyboard, focus, semantics, contrast, and reduced-motion checks for the public site and the authenticated study loop.
- Proposal: include accessibility expectations in the pull-request review checklist for user-visible changes.

## Security

- Proposal: establish a current dependency-audit cadence for production dependencies and document how findings are triaged.
- Proposal: verify response security headers at the active hosting edge and keep the checked-in deployment configuration aligned with that evidence.
- Proposal: enable the repository branch-protection and secret-scanning settings described in [docs/GITHUB_SETTINGS.md](docs/GITHUB_SETTINGS.md), subject to maintainer review.

## Documentation

- Proposal: make docs/ARCHITECTURE.md the current source of truth for the live code boundaries and clearly mark legacy migration notes.
- Proposal: add operational runbooks for database migrations, provider credentials, deployment rollback, and paused routes once the maintainer workflow is settled.
- Proposal: keep release notes and version tags synchronized after the first public release.

## Testing

- Proposal: add package-level checks to CI for stitch-app lint/build/regressions, docling-service pytest, and study-agent typecheck/build, while keeping provider-dependent tests explicit.
- Proposal: add focused integration coverage for the upload-to-lesson flow and document the required test services.
- Proposal: make the QA workflow's functional/manual scope and its stale configuration references converge with the current application architecture.
