<!-- open-orchestra: prompt-registry-v1 -->

# Code Generation Prompts

> Prompt register for source code, refactors, shared modules, and implementation-heavy changes.
> Commit this file so generated artifacts can be traced back to their prompt intent.
> Keep one entry per artifact or component; store only the latest prompt. Git history keeps prior versions.

## Agent Protocol

### Before creating or substantially changing an artifact

1. Read the full relevant register file in `.generated-prompts/`.
2. Search for an existing `## <ArtifactName>` entry.
3. Use prior entries to preserve project conventions, constraints, decisions, and known risks.
4. If a related entry exists, adapt the new work to fit that established context unless an explicit decision changes it.

### After creating or substantially changing an artifact

1. Add or update the matching `## <ArtifactName>` entry.
2. Increment **Iterations** on substantial updates.
3. Replace **Prompt** with the final prompt or a concise summary when the prompt is long.
4. Record key decisions and evidence links that explain why the artifact changed.
5. Do not update the register for typos, formatting-only edits, or single-line mechanical fixes.

## Usage

- Read this file before creating or substantially changing source code.
- Use previous entries to preserve naming, layering, module ownership, and test patterns.
- Update the matching component entry when behavior, responsibility, or architecture changes.

## Entry Format

```markdown
## <ArtifactName>

- **Created:** YYYY-MM-DD
- **Updated:** YYYY-MM-DD
- **Iterations:** N
- **Task:** TASK-ID or backlog item
- **Role:** active role that generated or changed the artifact

### Key decisions

- <Pattern, constraint, trade-off, or risk that shaped the artifact>

### Evidence

- <Command, test, review, screenshot, trace, or decision link>

### Prompt
```

<final prompt, or summary of the prompt key instructions if over 500 words>

````
---
```

<!-- Entries below this line are maintained by agents -->
````

## DeploymentErrorDiagnostics

- **Created:** 2026-05-22
- **Updated:** 2026-05-22
- **Iterations:** 1
- **Task:** PLUGIN-SF-ERROR-DIAGNOSTICS
- **Role:** developer

### Key decisions

- Added a deployment-layer normalizer that converts Salesforce deploy failure output into component, problem, probable cause, remediation, raw details, and category fields.
- Kept parsing local to deployment code and wired diagnostics into `SfCliIntegration` results plus failed wave persistence.
- Unknown Salesforce errors retain raw details and a generic validation next-step hint.

### Evidence

- `npx mocha "test/unit/deployment/deployment-error-diagnostics.test.ts" "test/unit/deployment/deployment-suite.test.ts" "test/unit/deployment/start-execution-service.test.ts"` passed.
- `npm test` passed.

### Prompt

```
Translate Salesforce metadata deploy errors into actionable diagnostics and remediation hints within the deployment/presentation/commands/test ownership scope. Cover missing fields, missing objects, duplicate metadata, permissions, invalid references, source tracking conflicts, and unknown fallback behavior while preserving existing dirty state from other workers.
```

---

## PlanExplainCommand

- **Created:** 2026-05-22
- **Updated:** 2026-05-22
- **Iterations:** 2
- **Task:** PLUGIN-PLAN-EXPLAIN
- **Role:** qa

### Key decisions

- Added `smart-deployment plan explain` as a read-only command that accepts start dry-run style planning inputs and returns a stable JSON result.
- Kept human output in a presenter and command text in a messages file to satisfy sf-plugin lint rules.
- Suppressed command/runtime console logs during `--json` execution so CI consumers receive a single parseable JSON payload.

### Evidence

- `npx eslint src/commands/plan/explain.ts src/deployment/plan-explain-service.ts src/presentation/plan-explain-presenter.ts test/unit/deployment/plan-explain-service.test.ts test/unit/commands/plan-explain.test.ts --color`
- `npx mocha --reporter spec "test/unit/deployment/plan-explain-service.test.ts" "test/unit/commands/plan-explain.test.ts"`
- `./bin/dev.js plan explain --json`

### Prompt

```
QA fix for PLUGIN-PLAN-EXPLAIN: verify the plan explain command behavior and keep JSON output stable for CI artifacts by ensuring `--json` emits only the final result object while preserving human summary output for non-JSON runs.
```

---

## CiPresetCommand

- **Created:** 2026-05-22
- **Updated:** 2026-05-22
- **Iterations:** 1
- **Task:** PLUGIN-CI-PRESET
- **Role:** developer

### Key decisions

- Added `smart-deployment ci preset` as a validation-safe CI command that reuses existing deployment context and plan report generation instead of creating a parallel artifact format.
- Kept deterministic CI exit-code policy in `CiPresetService`: `strict` fails with exit code 2 for plan blockers, while `warn-only` and `local-only` emit artifacts and exit 0 for plan blockers.
- Exposed GitHub Actions artifact paths through both JSON result fields and `GITHUB_OUTPUT` keys.

### Evidence

- `./node_modules/.bin/tsc -p . --pretty false --incremental false` passed.
- `./node_modules/.bin/tsc -p ./test --pretty false` passed.
- `./node_modules/.bin/eslint src/commands/ci/preset.ts src/deployment/ci-preset-service.ts test/unit/commands/ci-preset.test.ts test/unit/deployment/ci-preset-service.test.ts --color` passed.
- `./node_modules/.bin/mocha --reporter spec "test/unit/deployment/ci-preset-service.test.ts" "test/unit/commands/ci-preset.test.ts"` passed.
- `npm test` passed.

### Prompt

```
Implement PLUGIN-CI-PRESET in the CI preset ownership scope. Add a smart-deployment CI preset command that runs dry-run planning, validation-safe checks, report artifact generation, GitHub Actions output emission, and deterministic strict/warn-only/local-only exit-code handling without touching unrelated dirty canonical worktree files.
```

---

## ImpactCommand

- **Created:** 2026-06-03
- **Updated:** 2026-06-03
- **Iterations:** 1
- **Task:** PLUGIN-IMPACT-COMMAND
- **Role:** developer

### Key decisions

- Added `smart-deployment impact` as a read-only command that accepts either `--base` plus `--head` or working-tree analysis.
- Kept git diff/status access isolated in `ImpactAnalysisService` behind an injectable provider so command and dependency behavior can be tested without shelling out.
- Returned CI-oriented JSON with direct changes, transitive dependents, affected components, planned waves, and Apex test suggestions.

### Evidence

- `./node_modules/.bin/tsc -p . --pretty false --incremental false` passed.
- `./node_modules/.bin/tsc -p ./test --pretty false` passed.
- `./node_modules/.bin/eslint src/commands/impact.ts src/dependencies/impact-analysis-service.ts test/unit/commands/impact.test.ts test/unit/dependencies/impact-analysis-service.test.ts --color` passed.
- `./node_modules/.bin/mocha --reporter spec "test/unit/dependencies/impact-analysis-service.test.ts" "test/unit/commands/impact.test.ts"` passed.
- `npm test` passed.
- `./bin/dev.js impact --working-tree --json` returned parseable JSON.

### Prompt

```
Implement PLUGIN-IMPACT-COMMAND in an isolated worktree from origin/main commit f5aab23337389ac1d0f50ad00f218501db1d07ce. Add an impact command that accepts base/head refs or working-tree mode, reports directly changed components, transitive dependents, planned waves, and suggested Apex tests, and provides JSON suitable for CI decisions. Cover added, changed, deleted, and transitive dependency cases without touching unrelated graph export, init wizard, cache, scanner metadata support, or CI workflow files.
```

---

## GraphExportCommand

- **Created:** 2026-05-29
- **Updated:** 2026-05-29
- **Iterations:** 1
- **Task:** PLUGIN-GRAPH-EXPORT
- **Role:** developer

### Key decisions

- Added `smart-deployment graph export` as a local planning command that reuses `DeploymentContextService` instead of changing scanner, impact, cache, or deployment execution flows.
- Supports `--report-dir`, `--output`, `--format mermaid|dot|json|html`, and `--json` with JSON-safe result metadata for CI artifact collection.

### Evidence

- `tsc -p . --pretty false --incremental false` passed.
- `tsc -p ./test --pretty false` passed.
- Focused ESLint and Mocha graph export checks passed.
- `npm test` passed.

### Prompt

```
Implement PLUGIN-GRAPH-EXPORT in an isolated worktree from f5aab23. Add a graph export command that builds the existing dependency and wave context, writes selected Mermaid/DOT/JSON/HTML artifacts, keeps JSON output suitable for CI, avoids shared impact/cache/scanner/CI changes, and covers command behavior with focused tests.
```

---

## InitCommand

- **Created:** 2026-06-03
- **Updated:** 2026-06-03
- **Iterations:** 1
- **Task:** PLUGIN-INIT-WIZARD
- **Role:** developer

### Key decisions

- Added `smart-deployment init` as a deterministic, non-destructive command that delegates config generation to a service.
- Kept overwrite protection behind `--force` and logged generated project, source, and package summary for humans while returning structured JSON.
- Reused repo config types so generated source, cache, CI preset, and report defaults have a typed contract.

### Evidence

- `./node_modules/.bin/tsc -p . --pretty false --incremental false` passed.
- `./node_modules/.bin/tsc -p ./test --pretty false` passed.
- Focused ESLint and Mocha init checks passed.
- `npm test` passed.
- `./bin/dev.js init --source-path /private/tmp/sd-init-smoke-1780543803668 --force --non-interactive --json` exited 0.

### Prompt

```
Regenerate and integrate PLUGIN-INIT-WIZARD after the original worker worktree lost its source files. Add a Smart Deployment init command that detects Salesforce project structure, writes .smart-deployment.json with source/cache/CI/report defaults, refuses overwrite unless --force, and covers command/service behavior with tests.
```

---
