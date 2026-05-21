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
- **Iterations:** 2

### Key decisions

- Adapted the Open Orchestra Sonar workflow pattern for this repo: resolve Sonar host/provider from GitHub secrets and variables, support self-hosted local Sonar, align the SCM baseline with `main`, and route hosted runners through a Cloudflare Access proxy when `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are configured.
- Keep pull request checks non-blocking when Cloudflare Access rejects the service token, while preserving failure behavior on `push` and manual runs so the SonarQube Access policy issue remains visible before release.
- Kept this repo on `yarn install --frozen-lockfile --network-timeout 600000` and `yarn test:only` instead of copying Open Orchestra's `npm ci` and coverage/import steps.
- Reused the Open Orchestra Cloudflare Access service-token validation for the `gh_actions` client id.
- Pulled in the Open Orchestra quality-gate artifact pattern: scan steps continue long enough to collect Sonar API output, upload `sonar-insights`, and then fail explicitly if the scan or quality gate failed.
- Replaced Open Orchestra-specific `bin/orchestra.js sonar preflight/import` commands with direct SonarQube API collection for the `smart-deployment` project key.

### Prompt

```
Copy the SonarQube CI strategy from ~/dev/open-orchestra into smart-deployment. Preserve the Cloudflare Access proxy behavior, provider resolution, self-hosted runner support, quality gate wait, and insight artifact pattern. Adapt dependency installation, tests, and Sonar insight import for this repo by using yarn and direct SonarQube API calls for the `smart-deployment` project instead of Open Orchestra's `bin/orchestra.js sonar` commands.
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
