# Remove Staging Banner

- [completed] Identify the banner-specific runtime files and app-shell wiring to remove.
- [completed] Remove the banner from the staging UI without disturbing unrelated in-flight frontend edits.
- [completed] Verify the build, then commit and push the rollback to the working branch and `staging`.

## Review

- Removed the staging banner from the app shell and deleted the banner-only runtime files.
- Removed the banner offset CSS while leaving unrelated in-progress CSS edits untouched.
- Verified `npm run build`.
- Verified focused lint on `src/App.jsx`.
