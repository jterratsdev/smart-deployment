<!-- open-orchestra: prompt-registry-v1 -->

# Service and Domain Prompts

> Prompt register for domain models, service boundaries, API contracts, data flow, and backend behavior.
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

- Read this file before changing domain logic, service contracts, or persistence integration.
- Preserve API conventions, failure-mode decisions, idempotency, retries, and data ownership.
- Update entries when contracts, business rules, or service responsibilities change.

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

## PlanExplainService

- **Created:** 2026-05-22
- **Updated:** 2026-05-22
- **Iterations:** 1
- **Task:** PLUGIN-PLAN-EXPLAIN
- **Role:** developer

### Key decisions

- Reused `DeploymentContextService` and `SpecialDeploymentPlanService` instead of changing wave generation or provider planning.
- Reports direct dependencies, recursively discovered transitive blockers, unresolved references, provider-owned phase decisions, and confidence values in deterministic arrays.
- Carries `architecturalConcerns` in structured output per developer playbook requirements.

### Evidence

- `npx eslint src/commands/plan/explain.ts src/deployment/plan-explain-service.ts src/presentation/plan-explain-presenter.ts test/unit/deployment/plan-explain-service.test.ts test/unit/commands/plan-explain.test.ts --color`
- `npx mocha --reporter spec "test/unit/deployment/plan-explain-service.test.ts" "test/unit/commands/plan-explain.test.ts"`

### Prompt

```
Implement the smallest coherent plan explanation service for PLUGIN-PLAN-EXPLAIN using existing deployment context and provider plan services. The result must justify component placement, dependency edges, unresolved references, provider-owned metadata decisions, confidence levels, and empty plans without executing deployments or provider calls beyond existing local plan construction.
```

---

## GraphExportService

- **Created:** 2026-05-29
- **Updated:** 2026-05-29
- **Iterations:** 1
- **Task:** PLUGIN-GRAPH-EXPORT
- **Role:** developer

### Key decisions

- Kept graph artifact generation in `src/reports` with a structured report contract shared by Mermaid, DOT, JSON, and HTML renderers.
- Included deployment review metadata: components, dependency edges, wave grouping, cycle markers, isolated components, edge wave crossings, source, reason, and confidence.
- Escapes Mermaid, DOT, and HTML labels so metadata names cannot corrupt graph syntax or rendered HTML.

### Evidence

- `tsc -p . --pretty false --incremental false` passed.
- `tsc -p ./test --pretty false` passed.
- Focused ESLint and Mocha graph export checks passed.
- `npm test` passed.

### Prompt

```
Create a report-layer graph export service for PLUGIN-GRAPH-EXPORT that transforms the existing deployment context into review-ready graph metadata and renders Mermaid, DOT, JSON, and HTML without modifying shared dependency analysis semantics.
```

---

## InitConfigGenerationService

- **Created:** 2026-06-03
- **Updated:** 2026-06-03
- **Iterations:** 1
- **Task:** PLUGIN-INIT-WIZARD
- **Role:** developer

### Key decisions

- Centralized config generation in a service that detects `sfdx-project.json`, derives relative package paths, and writes deterministic JSON.
- Treats missing config as creatable, but surfaces unreadable or invalid existing config errors instead of silently replacing them.
- Stores CI preset defaults and report directories without executing deployment or validation commands.

### Evidence

- `./node_modules/.bin/tsc -p . --pretty false --incremental false` passed.
- `./node_modules/.bin/tsc -p ./test --pretty false` passed.
- Focused ESLint and Mocha init checks passed.
- `npm test` passed.
- `./bin/dev.js init --source-path /private/tmp/sd-init-smoke-1780543803668 --force --non-interactive --json` exited 0.

### Prompt

```
Create the init config generation service for PLUGIN-INIT-WIZARD with deterministic Salesforce project detection, overwrite protection, typed repo configuration output, and focused tests for defaults, force overwrite, and custom options.
```

---
