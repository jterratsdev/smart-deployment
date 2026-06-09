<!-- setup-agents: 2.0.2 -->

# CI/CD & Pipeline Prompts

> AI prompt register for Pipeline YAML, deployment scripts, GitHub Actions workflows, Azure Pipelines, MuleSoft deployment descriptors in this project.
> Maintained by the agent — one entry per component, latest prompt only.
> Commit this file so the team can trace every generated artifact back to its origin.

## Format

```
## <ComponentName>
- **Created:** YYYY-MM-DD
- **Updated:** YYYY-MM-DD   ← omit if never updated
- **Iterations:** N          ← increment on each substantial change

### Key decisions
- <Pattern / constraint / design choice that shaped the component>

### Prompt
```

<the final prompt that produced or substantially changed this component>
```
---
```

**Substantial change** = new method, new business requirement, pattern change, architectural refactor.
Minor fixes (typos, formatting, single-line corrections) do NOT update the prompt entry.

---

## Usage

When creating or modifying pipeline configuration, the agent reads this file for
existing stage structure, secret/variable naming, deployment target conventions,
and test gate thresholds already established in the project.

---

<!-- Entries below this line are maintained by the agent -->

## SonarQube

- **Created:** 2026-05-20
- **Updated:** 2026-05-20
- **Iterations:** 1

### Key decisions

- Adapted the Open Orchestra Sonar workflow pattern for this repo: resolve Sonar host/provider from GitHub secrets and variables, support self-hosted local Sonar, align the SCM baseline with `main`, and route hosted runners through a Cloudflare Access proxy when `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are configured.
- Keep pull request checks non-blocking when Cloudflare Access rejects the service token, while preserving failure behavior on `push` and manual runs so the SonarQube Access policy issue remains visible before release.
- Kept this repo on `yarn install --frozen-lockfile --network-timeout 600000` and `yarn test:only` instead of copying Open Orchestra's `npm ci` and coverage/import steps.
- Reused the Open Orchestra Cloudflare Access service-token validation for the `gh_actions` client id.

### Prompt

```
Copy the SonarQube CI strategy from ~/dev/open-orchestra into smart-deployment. Read the full Open Orchestra workflow to preserve the Cloudflare Access proxy behavior, provider resolution, secret/variable conventions, quality gate wait option, and service-token validation, while adapting dependency installation and tests to this repo.
```

---

## Acceptance Criteria Validation

- **Created:** 2026-05-20
- **Updated:** 2026-05-20
- **Iterations:** 1

### Key decisions

- Added a job-level timeout so the required acceptance validation check cannot remain in progress indefinitely.
- Restricted Salesforce NUTs to story-linked branches with an extracted issue number, because Dependabot branches do not run acceptance-criteria parsing and should not spend CI time on Salesforce integration tests.
- Added a step-level timeout around NUTs so real story PRs still exercise Salesforce integration coverage without blocking CI forever.

### Prompt

```
Fix the acceptance validation workflow so Dependabot PRs and other branches without linked issue numbers do not hang in the Salesforce NUTs step. Preserve the existing acceptance-criteria behavior for story-linked branches, but add explicit timeout guards and document the CI/CD decision.
```

---

## Smart Deployment CI Preset

- **Created:** 2026-05-22
- **Updated:** 2026-05-22
- **Iterations:** 1

### Key decisions

- Expose CI artifact paths through the CLI command's `GITHUB_OUTPUT` integration rather than adding a new always-on workflow that could affect existing repository CI.
- Keep GitHub Actions outputs stable: `deployment_plan_json`, `deployment_plan_html`, `deployment_report_dir`, `deployment_status`, and `deployment_exit_code`.

### Prompt

```
Document the CI/CD behavior for PLUGIN-CI-PRESET: expose deterministic deployment plan artifact paths for GitHub Actions while avoiding active workflow changes that would alter existing CI behavior without release wiring.
```

---

## HostedMinuteOptimization

- **Created:** 2026-06-09
- **Updated:** 2026-06-09
- **Iterations:** 1

### Key decisions

- Moved normal Linux validation paths to the trusted self-hosted Linux runner labels `self-hosted`, `linux`, and `smart-deployment`, with `CI_LINUX_RUNNER=github-hosted` as an explicit temporary fallback.
- Kept Windows build and Windows NUT coverage, but limited them to weekly scheduled runs or manual workflow dispatch with `run_cross_os=true`.
- Kept package.json push-triggered npm release preparation on trusted main, using the committed package version, while moving the job to trusted Linux by default.
- Gated acceptance-validation NUTs behind a `run-nuts` PR label to control expensive Salesforce integration coverage.
- Documented runner setup, security boundaries, workspace cleanup expectations, fallback behavior, and branch hygiene in `docs/ci-runner-policy.md`.

### Prompt

```
Apply the Open Orchestra CI hosted-minute optimization strategy to smart-deployment. Move normal Linux CI work to trusted self-hosted Linux, keep Windows/cross-OS checks as manual or nightly coverage, preserve release and secret safety, keep automatic package.json push publishing on trusted main, gate expensive NUTs, and document runner labels, security boundaries, fallback behavior, cleanup, and branch hygiene.
```

---
