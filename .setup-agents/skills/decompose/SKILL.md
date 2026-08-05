---
name: decompose
description: >-
  Decompose an epic or oversized story into independently deliverable slices,
  each recorded in the local backlog.
  USE FOR: decompose epic, split story, break down XXL, slice work, story splitting,
  decomposition.
  Reusable by BA and TA profiles.
---

# Decompose

## Backlog is Local (CRITICAL)

Each resulting slice is a task in the **repo-resident backlog** (`.setup-agents/state/tasks.jsonl`).
Persist every slice with:

```bash
sf setup-agents task create --id <ID> --summary "<slice title>" --role <role>
```

Do NOT create the slices in Jira. Atlassian MCP is optional (mirror-only).

## 1. When to Decompose

- The story is sized **XXL** — this is a **split gate**, not an estimate; it MUST be split.
- The story spans more than one iteration, persona, or bounded context.
- Refinement surfaced independent value that can ship separately.

## 2. Splitting Patterns

| Pattern | Split by |
|---------|----------|
| Workflow steps | Each step / stage in the business process. |
| Business rules | Happy path first, then each rule/variation. |
| Data variations | One representative type, then the rest. |
| CRUD | Read/create first, then update/delete. |
| Interfaces | One channel (UI, API, MCP) at a time. |

Each slice must remain **independently valuable and testable** (INVEST). Do not split into
technical layers that deliver no standalone value.

## 3. Preserve Traceability

- Every slice links back to the parent epic/story ID.
- Carry the parent acceptance criteria down to the slice they belong to; no orphan ACs.
- Declare cross-slice dependencies explicitly.

## 4. Output

Produce a slice table (Slice ID | Title | Parent | Value | Depends on | Size) and create a
local task per row. Re-size each slice; any slice still XXL is split again before estimation.