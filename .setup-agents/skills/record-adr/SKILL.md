---
name: record-adr
description: >-
  Record an Architecture Decision Record (ADR). Writes ADP-style Markdown ADRs
  (Context / Decision / Consequences / Alternatives) and round-trips them into
  setup-agents decision records (.setup-agents/state/decisions.jsonl) and back.
  USE FOR: record ADR, architecture decision, decision record, capture decision,
  ADR markdown, decision log. Owned by the architect (ta) profile.
---

# record-adr

Capture architecture decisions as ADP-style Markdown ADRs and keep them in sync
with the setup-agents decision store. Use the bidirectional translator so a
Markdown ADR round-trips losslessly to a `SetupAgentsDecisionRecord` and back.

## When to use

When a technical decision is made (architecture, integration, data model, sizing)
that a reviewer must be able to read in a diff and that must also live in the
JSONL decision store for the workflow.

## ADR Markdown shape

```markdown
# <Decision title>

## Context

Why this decision is needed; forces at play.

## Decision

The decision that was made.

## Consequences

Trade-offs and follow-on effects (positive and negative).

## Alternatives

- Alternative A — why rejected
- Alternative B — why rejected
```

## Field mapping (Markdown ↔ decision record)

| ADR section | Decision record field |
|-------------|-----------------------|
| `# title` | `summary` |
| `## Context` | `rationale` (body) |
| `## Decision` | `outcome` |
| `## Consequences` | carried inside `rationale` under `<!-- adr-carry -->` (no direct slot) |
| `## Alternatives` | `alternatives[]` |

The `## Consequences` section has no dedicated record field, so the translator
carries it inside `rationale` under a delimiter block. This makes both
`record → markdown → record` and `markdown → record → markdown` stable.

## Protocol

1. Draft the ADR in the Markdown shape above.
2. Convert to a decision record with `adrMarkdownToRecord(md, { owner: "architect", taskIds })`
   from `src/services/adr-translator.ts`.
3. Persist it via `sf setup-agents decision add` / `orchestra decision add` (the
   `summary`, `rationale`, `outcome`, and `alternative` flags map to the record).
4. To review an existing decision as an ADR, load the record and render it with
   `recordToAdrMarkdown(record)`.

## Rules

- Keep the ADR title short and specific; it becomes the decision `summary`.
- Do not hand-edit the `<!-- adr-carry -->` block inside `rationale`; it is
  machine-managed for lossless round-trip. Edit above it.
- One decision per ADR.