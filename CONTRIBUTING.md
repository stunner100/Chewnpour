# Contributing to Chewnpour

Thank you for taking the time to improve Chewnpour. This guide describes the current repository workflow; if a command changes, update this document and the relevant package documentation in the same pull request.

## Development setup

Chewnpour is a monorepo-style repository with independently managed packages. There is no root package manager workspace.

For the main web application:

~~~bash
npm install --prefix stitch-app
cp stitch-app/.env.example stitch-app/.env.local
~~~

Fill only the variables needed for the flow you are testing. Keep database URLs, auth secrets, provider keys, service-role keys, and test credentials out of git.

Run the local API/auth process and Vite in separate terminals:

~~~bash
cd stitch-app
npm run dev:auth
~~~

~~~bash
cd stitch-app
npm run dev
~~~

For the document-extraction service:

~~~bash
python3 -m venv docling-service/.venv
source docling-service/.venv/bin/activate
python -m pip install -e "docling-service[dev]"
~~~

Run its tests from the service directory:

~~~bash
cd docling-service
pytest
~~~

For the study worker:

~~~bash
npm install --prefix study-agent
npm run typecheck --prefix study-agent
npm run build --prefix study-agent
~~~

The study-agent package declares Node.js 24 or newer. Its runtime also needs the database and worker authentication variables described in [study-agent/.env.example](study-agent/.env.example).

## Repository structure

- stitch-app contains the main React/Vite application, API router, server modules, migrations, and regression scripts.
- docling-service contains the FastAPI extraction adapter and its pytest contract tests.
- study-agent contains the Eve-based study-worker package.
- chewnpour-product-video contains an independent Hyperframe product-video project.
- .github/workflows contains GitHub Actions.
- docs contains architecture, release, repository-settings, and project-preparation documentation.
- Agent and skill directories are repository assets. Contributors should not remove or rewrite them merely because they are unfamiliar; change them only when the task explicitly concerns them.

## Branches and scope

Create a focused branch from master. Use a descriptive prefix such as feat/, fix/, chore/, docs/, or test/, followed by a short kebab-case description. The branch for this repository-preparation work is chore/oss-readiness.

Keep pull requests narrow enough that a reviewer can understand the intent and verify the behavior. Separate unrelated refactors, formatting sweeps, and application redesigns from documentation or maintenance work.

The pull-request size gate in the QA workflow currently uses these defaults:

- At most 60 changed files.
- At most 2,500 total changed lines.
- At most 900 changed lines in one file.
- At most 900 lines in a source file.

The gate ignores build output, dependencies, generated files, virtual environments, QA results, package-lock files, and stitch-app/public assets in the relevant calculations.

## Bugs

Before opening a bug report, search existing issues and confirm that the behavior is reproducible on the current branch or a clearly identified commit. Use the bug report form and include the smallest reproduction you can provide, the affected package, environment details, logs, and screenshots where useful. Remove secrets and personal data from all attachments.

## Feature proposals

Feature requests should describe the user problem before prescribing an implementation. Explain the proposed solution, alternatives considered, affected package or route, and any privacy, security, accessibility, or migration implications. A feature request is a proposal until a maintainer accepts it for implementation.

## Pull requests

A pull request should include:

- A concise summary and the problem being addressed.
- The packages and files changed.
- Tests, lint, and build commands run, including failures or provider-dependent checks that could not run.
- Screenshots or recordings for user-visible changes.
- Security, privacy, migration, and breaking-change notes.

Use the pull-request template. Review the diff for accidental secrets, generated artifacts, unrelated changes, and stale documentation before requesting review.

## Testing, linting, and builds

The main application has no npm test script. Use its actual validation commands:

~~~bash
npm run lint --prefix stitch-app
npm run build --prefix stitch-app
node stitch-app/scripts/run-all-tests.mjs
~~~

Run a single stitch-app regression script from the package directory:

~~~bash
cd stitch-app
node scripts/<name>.test.mjs
~~~

The runner skips live, smoke, benchmark, probe, network, and other provider-dependent scripts by default. Use the script's documented options only when the required services and credentials are available.

Run the extraction-service tests with:

~~~bash
cd docling-service
pytest
~~~

Run the study-agent checks with:

~~~bash
npm run typecheck --prefix study-agent
npm run build --prefix study-agent
~~~

If changing the product-video package, use its declared command:

~~~bash
npm run lint --prefix chewnpour-product-video
~~~

## Commit messages

Use a short, imperative subject with a conventional prefix where it helps reviewers, for example:

~~~text
docs: clarify local development setup
fix: preserve upload status during retries
chore: update contributor guidance
~~~

Keep the subject focused and explain migration or operational impact in the body when needed. The repository does not currently declare a commit-message linter, so this is project guidance rather than an automated gate.

## Review and CI

Pull requests target master. The QA workflow runs for opened, synchronized, reopened, and ready-for-review pull requests, and can also be started manually. It:

1. Checks out full history and runs stitch-app/scripts/pr-size-gate.mjs against the base branch.
2. Installs ImageMagick, Node 22, Python 3.13, and the Factory droid CLI.
3. Runs the repository QA skill using configured secrets and test services.
4. Uploads the QA report and raw output, then creates or updates a pull-request comment.
5. Fails the job when the QA step fails, even though the report-producing step is allowed to complete.

The repository QA skill performs functional/manual QA and does not replace package lint, typecheck, unit, or build commands. A missing credential or unavailable integration should be reported as blocked or inconclusive rather than hidden.

At the time of this guide, master has no branch-protection rule. The recommended settings are recorded in [docs/GITHUB_SETTINGS.md](docs/GITHUB_SETTINGS.md).

Maintainers may request changes, ask for a smaller scope, or close a pull request that cannot be reviewed safely. Do not merge your own pull request without the applicable review and CI requirements.

## Maintainer handling

Maintainers triage issues, confirm scope, review code and documentation, verify QA evidence, coordinate security reports privately, and decide when changes are ready for release. Changes that affect database migrations, authentication, uploads, AI providers, payments, or deployment should include an explicit operational note.

## Code of conduct and security

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). For security vulnerabilities, follow [SECURITY.md](SECURITY.md) and use a private reporting channel.
