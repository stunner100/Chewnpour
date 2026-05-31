# Convex SQLite and Postgres Website Benchmark

## Plan

- [x] Inspect deployed frontend targets, backend persistence, guarded cleanup,
  and existing authenticated E2E patterns.
- [x] Agree on the production-write safety boundary and benchmark design.
- [x] Review the committed design checkpoint with the user.
- [x] Write the execution plan for the approved deployed website benchmark.
- [ ] Create a temporary Playwright benchmark harness outside committed source.
- [ ] Run the approved disposable-account website journey against SQLite
  production.
- [ ] Run the approved disposable-account website journey against Postgres
  staging.
- [ ] Run guarded cleanup dry-run, deletion, and post-cleanup verification for
  both accounts.
- [ ] Summarize database-heavy route timings, provider timings, errors, cleanup
  evidence, and interpretation limits.

## Review

Pending benchmark execution.
