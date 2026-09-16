# Releasing Chewnpour

Chewnpour has no tagged release history in the reviewed repository. This document describes a lightweight process for the first and subsequent GitHub Releases; it does not create a release.

## Versioning

Use Semantic Versioning:

- Patch releases fix backwards-compatible defects or documentation and maintenance issues.
- Minor releases add backwards-compatible functionality.
- Major releases change public behavior, APIs, data contracts, or migration expectations incompatibly.

Use a tag in the form vX.Y.Z and keep the version in the release title and notes.

## Release checklist

1. Confirm the pull request is reviewed and merged into master.
2. Review CHANGELOG.md and move the release entries from Unreleased into a new version section with the release date.
3. Run the applicable package checks:

~~~bash
npm run lint --prefix stitch-app
npm run build --prefix stitch-app
node stitch-app/scripts/run-all-tests.mjs
npm run typecheck --prefix study-agent
npm run build --prefix study-agent
~~~

Run the extraction-service check from its package directory with its virtual environment active:

~~~bash
cd docling-service
pytest
~~~

Run only the checks applicable to the packages changed in the release, and record provider-dependent checks that were blocked.

4. Review database migrations, authentication changes, provider changes, storage behavior, and external-service configuration for operational impact.
5. Confirm the intended deployment targets and environment variables with the hosting dashboards. Do not publish secret values in release notes.
6. Create the annotated version tag after the release commit:

~~~bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
~~~

7. Create a GitHub Release for the tag, summarize user-visible changes and migration notes, and link to the corresponding changelog section.
8. Verify the deployed frontend, API health, extraction-service health, authentication, upload path, and one representative study flow.

## Rollback

If a release causes a regression, stop further rollout, record the observed failure, and use the hosting provider's documented rollback or redeploy of the last known-good commit. Database migrations must have an explicit backwards-compatibility or recovery plan before release; do not assume that reverting application code reverses a migration.

## Hotfixes

Create a focused fix branch from the last release or current master as appropriate, run the same affected-package checks, document the incident and user impact, and publish the next patch version after review.
