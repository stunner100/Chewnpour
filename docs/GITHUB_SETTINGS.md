# Recommended GitHub settings

## Current state

The public repository is stunner100/Chewnpour. On 2026-09-16, the master branch had no branch-protection rule. This task does not configure protection automatically because a single-maintainer project should verify the exact rule and its required checks before enabling it.

## Recommended master protection

In the repository settings, open Settings, then Rules, and create a branch rule or ruleset targeting master with the following baseline:

- Require a pull request before merging.
- Require 0 approvals initially so the primary maintainer is not locked out. Change this to 1 approval when an independent reviewer is available.
- Require the qa status check from .github/workflows/qa.yml to pass.
- Require conversation resolution before merging.
- Block force pushes.
- Block branch deletion.
- Leave push restrictions unset unless a maintainer team is formally configured.
- Keep administrator enforcement disabled during initial rollout so the owner retains a recovery path.

Do not require optional external contexts such as CodeRabbit, Macroscope, or Vercel until they are confirmed as stable, intentional gates for every contributor. Do not require a preview deployment that the repository cannot guarantee for every pull request.

Once the workflow is stable and contributors need stronger protection, consider requiring the branch to be up to date before merging and dismissing stale approvals. Test those settings with a small pull request before enforcing them.

## QA-specific notes

The QA workflow has contents: write and pull-requests: write permissions because it may publish its report and open a draft catalog-update pull request for generated skill updates. If branch rules are tightened, confirm that this bot-created branch path still works and that it never pushes directly to master.

The current workflow is a functional/manual QA gate. It does not run the package lint, build, typecheck, or regression commands automatically. Consider adding those as separate named checks before making them required; do not list them as required checks until the workflows exist.

## Repository hygiene settings

Also review these settings:

- Enable private vulnerability reporting when available.
- Enable Dependabot alerts and security updates if they fit the maintainer workflow.
- Enable secret scanning and push protection when available for the repository plan.
- Keep the repository public unless the maintainer explicitly decides otherwise.
- Protect the master default branch and do not delete existing branches as part of this setup.
