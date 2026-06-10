<!-- setup-agents: 2.0.2 -->

# Test Prompts

> AI prompt register for Test plans, Playwright specs, Apex test classes, MUnit tests in this project.
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

## PlanExplainService

- **Created:** 2026-05-22
- **Updated:** 2026-05-22
- **Iterations:** 1

### Key decisions

- Added focused unit coverage for dependency placement with transitive blockers, provider-owned decisions, unresolved references, empty plans, and command input passthrough.
- Used injected service doubles to avoid real project scanning, deployments, provider calls, or remote state.

### Prompt

```
Create unit tests for PLUGIN-PLAN-EXPLAIN covering dependency placement, provider placement, unresolved references, empty plans, and command acceptance of start dry-run style inputs. Keep tests deterministic and local-only.
```

---

```

**Substantial change** = new method, new business requirement, pattern change, architectural refactor.
Minor fixes (typos, formatting, single-line corrections) do NOT update the prompt entry.

---

## Usage

When creating tests, the agent reads this file for existing PSG assignments used in
System.runAs(), fixture patterns, page object model structure, and coverage conventions.

---

<!-- Entries below this line are maintained by the agent -->

## DeploymentErrorDiagnostics
- **Created:** 2026-05-22
- **Updated:** 2026-05-22
- **Iterations:** 1

### Key decisions
- Added focused unit coverage for Salesforce deploy diagnostic categories and unknown fallback behavior.
- Extended existing deployment integration tests to verify parsed failed JSON output includes actionable diagnostics and failed wave state stores formatted remediation hints.

### Prompt
```

Create unit tests for Salesforce metadata deploy error diagnostics covering known mappings for missing fields, missing objects, duplicate metadata, permissions, invalid references, source tracking conflicts, and unknown fallback behavior. Verify SF CLI result parsing and failed wave persistence carry actionable diagnostics.

```
---
```

## GraphExportService

- **Created:** 2026-05-29
- **Updated:** 2026-05-29
- **Iterations:** 1

### Key decisions

- Added focused unit coverage for Mermaid, DOT, JSON, and HTML generation, empty graph behavior, deployment wave grouping, cycle markers, and escaping/sanitization.
- Added command-level coverage for format selection, report directory output, exact output path override, and JSON-safe result metadata.

### Prompt

```
Cover PLUGIN-GRAPH-EXPORT with deterministic local unit tests for all graph artifact formats, empty graph handling, wave grouping, cycle metadata, escaping/sanitization, and command flag passthrough without requiring Salesforce org access.
```

---

## InitWizardTests

- **Created:** 2026-06-03
- **Updated:** 2026-06-03
- **Iterations:** 1

### Key decisions

- Added focused service tests for default generation, existing config protection, and forced overwrite with non-default automation flags.
- Added command coverage using a parse/log test double to verify non-interactive defaults write config without invoking remote Salesforce state.

### Prompt

```
Cover PLUGIN-INIT-WIZARD with deterministic local unit tests for config generation defaults, overwrite protection, force overwrite behavior, and command passthrough using temporary Salesforce project fixtures.
```

---

## CommitScopeServiceTests

- **Created:** 2026-06-05
- **Updated:** 2026-06-05
- **Iterations:** 1

### Key decisions

- Added focused unit coverage for changed component selection, required dependency inclusion, unrelated metadata exclusion, story manifest commit loading, deleted metadata ignoring, bundle path matching, and CI flag passthrough.
- Used injected git change providers and mocked deployment contexts so tests remain local-only and deterministic.

### Prompt

```
Cover commit/story scoped deployment planning with deterministic unit tests that verify metadata outside selected commits is excluded, dependencies are included, deleted files do not cause destructive behavior, bundle paths resolve, and CI command flags pass scope options into analysis.
```

---

## CommitScopedDeploymentsNUT

- **Created:** 2026-06-05
- **Updated:** 2026-06-05
- **Iterations:** 1

### Key decisions

- Added a deterministic NUT that creates a temporary Salesforce project, initializes git, makes real commits, writes a story scope manifest, and runs `ci preset` in `local-only` mode through the dev CLI.
- Verified the generated deployment plan includes only scoped metadata plus required dependencies, excludes unrelated trunk metadata, and keeps deleted scoped files out of normal deployment waves without mutating source.

### Prompt

```
Act as QA for PLUGIN-COMMIT-SCOPED-DEPLOYMENTS and add small deterministic end-to-end coverage using a real temporary git Salesforce fixture. Validate story manifest scoped commits through ci preset local-only before commit, including dependency inclusion, unrelated trunk exclusion, and deleted metadata safety.
```

---

## RetrieveForceIgnoreTests

- **Created:** 2026-06-05
- **Updated:** 2026-06-05
- **Iterations:** 1

### Key decisions

- Added deterministic unit coverage with temporary git projects instead of requiring a Salesforce org.
- Covered tracked protected restore, untracked protected cleanup, strict failure after restore, DigitalExperience meta normalization, porcelain parsing, and command flag passthrough.

### Prompt

```
Cover issue #222 with local deterministic tests for forceignore-safe retrieve behavior. Use fake retrieve runners and temporary git repositories to verify protected bundle sub-path restoration, strict ignore failure, meta normalization, and command flag passthrough without remote Salesforce access.
```

---

## DestructiveRollbackTests

- **Created:** 2026-06-05
- **Updated:** 2026-06-05
- **Iterations:** 2

### Key decisions

- Added focused unit coverage for destructive manifest generation, SF CLI command construction, forceignore staging preservation, reverse wave execution, and rollback diff classification.
- Added start --help smoke coverage through the dev CLI using a temporary HOME to avoid Salesforce CLI log permission issues.
- Added a CLI E2E/NUT that creates a temporary Salesforce project, tags v1.2.0 and v1.2.1, runs `start --rollback-from v1.2.0 --rollback-to v1.2.1 --dry-run --json`, and verifies added metadata is destructive while modified/deleted metadata is restore.

### Prompt

```
Cover issue #225 with deterministic local tests and CLI E2E coverage for destructive wave manifests, post destructive deploy options, DeploymentRunner staging behavior, StartExecutionService reverse wave order, RollbackPlanningService A/M/D classification, start command help flags, and release-tag rollback planning through the dev CLI.
```

---

## GenAiPlannerBundleScannerTests

- **Created:** 2026-06-05
- **Updated:** 2026-06-05
- **Iterations:** 1

### Key decisions

- Added scanner fixture coverage for Employee Copilot planner inclusion, generated AgentScript planner exclusion, and extracted Flow/Apex/prompt dependencies.
- Added ProjectAnalysisService coverage proving deployable GenAiPlannerBundle components land in waves after referenced automation metadata and do not appear as unplaced.

### Prompt

```
Cover GitHub issue #223 with local deterministic tests for Employee Copilot GenAiPlannerBundle scanning and wave placement, including exclusion of generated AgentScript planner bundles that have a matching AiAuthoringBundle source.
```

---

## DeploymentValidationHarness

- **Created:** 2026-06-05
- **Updated:** 2026-06-09
- **Iterations:** 4

### Key decisions

- Added deterministic fake `sf` fixtures for deploy start, report, and resume responses without requiring a live Salesforce org.
- Covered start-style deployment success, partial failure, and timeout through `DeploymentRunner` with real manifest generation and `SfCliIntegration`; kept command-level NUT coverage for validate, status, and resume remote deployment id behavior.
- Documented that full `start` NUT execution with `--target-org` still requires a source change or Salesforce-core org resolver seam because target org parsing occurs before the fake `sf` binary is invoked.
- Updated the command-level fake `sf` fixture to execute by explicit path and generate a Windows `.cmd` wrapper so Windows NUTs do not depend on extensionless executable resolution.
- Adjusted direct fixture verification to execute `sf-node.js` through `process.execPath`, avoiding Windows `spawn EINVAL` when `execFile` receives a `.cmd` wrapper directly.
- Added command-level NUT assertions for `status --target-org --json` and `resume --target-org --json`, validating both real command stdout and fake `sf project deploy report/resume` invocation arguments.

### Prompt

```
Implement GitHub issue #198 / NEXT-001-validation-harness, fix the Windows NUT failures by making the fake sf fixture executable cross-platform, and add command-level remote status/resume NUT coverage. The harness should expose an sf.cmd wrapper for CLI PATH resolution, run direct fixture checks through process.execPath and sf-node.js to avoid Windows spawn EINVAL, and verify `status --target-org --json` plus `resume --target-org --json` stdout and fake sf invocation arguments without requiring a Salesforce org.
```

---

## RemoteDeploymentStatusResumeTests

- **Created:** 2026-06-08
- **Updated:** 2026-06-08
- **Iterations:** 1

### Key decisions

- Added unit coverage for DeploymentStatusService refreshing failed state from a successful remote deploy report.
- Added unit coverage for ResumeDeploymentService invoking remote deploy resume and persisting remote resume metadata.
- Kept command tests local-only by omitting --target-org unless the test intends remote behavior.

### Prompt

```
Cover NEXT-001 remote status/resume behavior with deterministic tests that do not require a Salesforce org. Verify status maps sf deploy report results back into persisted state and resume calls sf deploy resume when target-org is present.
```

---
