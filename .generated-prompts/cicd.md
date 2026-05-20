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
