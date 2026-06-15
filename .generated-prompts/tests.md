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

## PlanningAnalysisCache

- **Created:** 2026-06-04
- **Updated:** 2026-06-04
- **Iterations:** 1

### Key decisions

- Added deterministic unit coverage using temporary SFDX projects and injected scanner doubles.
- Covered repeated cache hits, metadata/config/parser-version invalidation, corrupt cache recovery, disabled mode, and plan explain CLI passthrough for cache flags.

### Prompt

```
Create focused unit tests for PLUGIN-ANALYSIS-CACHE covering cache hits, metadata/config/package/parser-version invalidation, corrupt cache recovery, disabled mode, and CLI cache flag passthrough. Keep tests local-only with no deployments or provider API calls.
```

---

## DeploymentValidationHarness198

- **Created:** 2026-06-12
- **Updated:** 2026-06-12
- **Iterations:** 1

### Key decisions

- Added deterministic NUT coverage with a temporary fake `sf` executable for command-level start/report/resume behavior without calling a live org.
- Added an opt-in live Salesforce e2e guarded by `SMART_DEPLOYMENT_LIVE_TARGET_ORG` so connected-org validation is available without making CI depend on org state.
- Covered remote deployment id persistence, failed-wave state, status refresh from `project deploy report`, and resume delegation to `project deploy resume`.

### Prompt

```
Complete issue 198 by adding a production-like deployment validation harness. Use deterministic command-level fixtures for `sf project deploy start/report/resume`, but keep true Salesforce e2e separate and opt-in against a connected org. Validate persisted state, manifests, remote deployment ids, status polling, resume semantics, and live validate/report behavior without requiring live org access in normal CI.
```

---
