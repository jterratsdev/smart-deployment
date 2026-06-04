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
