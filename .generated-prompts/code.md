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
