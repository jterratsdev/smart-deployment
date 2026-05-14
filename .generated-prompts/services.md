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
