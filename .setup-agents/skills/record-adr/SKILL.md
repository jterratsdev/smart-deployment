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

| ADR section/metadata                                           | Decision record field                                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `# title`                                                      | `summary`                                                                                                                                 |
| metadata block (Status/Date/Decided by/Related tasks/Evidence) | `status`/`createdAt`/`owner`/`taskIds`/`evidenceIds` — parsed back by `adrMarkdownToRecord`; an explicit `options` value wins             |
| `## Context`                                                   | `rationale` (body)                                                                                                                        |
| `## Decision`                                                  | `outcome` (falls back to `summary` when `outcome` is empty or only a bare status word)                                                    |
| `## Consequences`                                              | carried inside `rationale` under `<!-- adr-carry -->` (no direct slot); renders "_Not recorded._" when absent                             |
| `## Alternatives`                                              | `alternatives[]`                                                                                                                          |
| (not an ADR section)                                           | `category` — `architecture` gets its own numbered ADR file; `process` (the default) does not (unless `decision render --include-process`) |
| (not an ADR section)                                           | `supersedes`/`supersededBy` — rendered as the index's forward link                                                                        |

The `## Consequences` section has no dedicated record field, so the translator
carries it inside `rationale` under a delimiter block. This makes both
`record → markdown → record` and `markdown → record → markdown` stable.

## Readable ADR filenames and the index

Architectural decisions render as `docs/adr/ADR-<NN>-<slug>.md` — a number plus a short slug
of the summary. `decision add` assigns the number and persists it on the record (`adrNumber`);
a record from before that field existed takes its position in `decisions.jsonl`. A number is
never reused for a different decision and never renumbered, even if the decision is later
reclassified. A process-category decision takes no number and never gets its own file by
default; it appears only in `docs/adr/README.md`'s appendix, by id, with no free text. That
index is always rewritten alongside any render: current decisions, superseded decisions (with
a forward link to whatever superseded them), and the process appendix.

Numbers are allocated per clone. `import`/`sync --pull` drop an incoming number another
decision already holds (with a warning) and assign the next free one. If two clones' logs are
merged directly and two decisions hold the same number, every render warns and lists both ids
under the index's "Number collisions" section; neither is renumbered or merged, and each gets
its own filename (an id suffix is appended). Resolve the duplicate by hand.

Upgrading from the pre-existing `ADR-<id>.md` naming: those files are never renamed or
deleted automatically — they stay on disk, and the next render adds the new numbered files
alongside them. Update any hand-written links to an old `ADR-<id>.md` path manually.

## Protocol

1. Draft the ADR in the Markdown shape above.
2. Convert to a decision record with `adrMarkdownToRecord(md, { owner: "architect", taskIds })`
   from `src/services/adr-translator.ts`.
3. Persist it via `sf setup-agents decision add` (the
   `summary`, `rationale`, `consequences`, `status`, `outcome`, `category`, `supersedes`, and
   `alternative` flags map to the record). Pass `--category architecture` explicitly for a
   real architecture decision — ADR title, numbered file, and the ADR-focused rendering all
   follow from it. The default is `process`; most recorded decisions (gate verdicts, phase
   bookkeeping, scope calls) should stay on it — they are not meant to read as ADRs.
4. To review an existing decision as an ADR, load the record and render it with
   `recordToAdrMarkdown(record)`, or run `sf setup-agents decision render`.
5. To change a decision's status, or record that another decision now supersedes it, use
   `sf setup-agents decision update --id <id> --profile <profile> --status <status>
--superseded-by <id>` — `--profile` (or `--role`) is required and is recorded as `updatedBy`.
   The log stays append-only, exactly like a `review complete` update. To record a new decision
   that replaces an old one in one step, use `decision add --supersedes <oldId>`.

## Rules

- Keep the ADR title short and specific; it becomes the decision `summary`. `decision add`
  warns (non-blocking) past 80 characters.
- Record `--consequences` for every architecture decision; `decision add` warns (non-blocking)
  whenever it is omitted.
- Do not hand-edit the `<!-- adr-carry -->` block inside `rationale`; it is
  machine-managed for lossless round-trip. Edit above it.
- One decision per ADR.
- Link supporting evidence with `--evidence`; `decision add` warns (non-blocking) when the
  task already has recorded evidence that was not linked.
