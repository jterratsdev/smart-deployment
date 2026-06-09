![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# CI Runner Policy

Author: Salesforce Professional Services

Version: 1.0

## Purpose

Smart Deployment keeps fast feedback on trusted Linux infrastructure while reserving GitHub-hosted Windows coverage for explicit cross-OS checks. The policy reduces hosted-minute usage without removing release-critical validation.

## Runner Labels

The default Linux runner is selected with:

```yaml
runs-on: [self-hosted, linux, smart-deployment]
```

Set repository or organization variable `CI_LINUX_RUNNER=github-hosted` only as a temporary fallback when the trusted self-hosted runner is offline. When unset, CI expects the self-hosted Linux runner.

The Sonar workflow keeps its existing Sonar-specific labels:

```yaml
runs-on: [self-hosted, sonar, local-sonar]
```

## Required Runner Setup

The `smart-deployment` Linux runner must provide:

- Node.js 24 support through `actions/setup-node`.
- Yarn 1.x compatibility.
- npm network access for dependency restore and Salesforce CLI installation.
- Git, bash, tar, and standard Linux build tools.
- A clean workspace per job, either through ephemeral runners or runner-level cleanup.

Do not run this label on a general-purpose developer machine. Use a dedicated host or isolated runner environment.

## Workflow Policy

- `Tests / Linux unit tests` runs on trusted Linux after lockfile validation.
- `Tests / NUTs (self-hosted Linux)` runs on trusted Linux for normal push validation.
- `Tests / Windows build check` and `Tests / NUTs (windows manual/nightly)` run only on the weekly schedule or when `workflow_dispatch.run_cross_os=true`.
- `Acceptance Criteria Validation` runs on trusted Linux; NUTs require the `run-nuts` pull request label.
- `Publish to npm` runs on release, manual dispatch, or `main` pushes that modify `package.json`.
- `Deploy to Cloudflare Pages` uses trusted Linux and deploys only from `main` or manual runs.

## Security Boundaries

- Do not expose npm or Cloudflare secrets to untrusted fork contexts.
- Do not run self-hosted secret-bearing jobs for Dependabot or untrusted PRs.
- Keep publish workflows constrained to release events, workflow dispatch, and trusted `main` package version pushes.
- Review any runner fallback to `github-hosted` as a temporary operations decision, not the steady state.

## Branch Hygiene

Before creating a feature branch after CI workflow changes, update the local branch from `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c <branch-name>
```

## Evidence Baseline

Recent push runs before this policy showed the `Tests` workflow taking roughly 12-27 minutes of wall time because Windows NUTs and Windows build checks ran on every push. A representative successful run included:

- lockfile check: about 8 seconds
- Linux unit tests: about 1 minute
- Windows build check: about 2 minutes
- Ubuntu NUTs: about 2 minutes
- Windows NUTs: about 15 minutes

After this policy, normal push validation keeps Linux coverage and removes Windows hosted-minute usage from the default path.
