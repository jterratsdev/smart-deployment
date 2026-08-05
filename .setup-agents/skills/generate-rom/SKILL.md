---
name: generate-rom
description: >-
  Produce a Rough Order of Magnitude (ROM) effort baseline for a story or epic and
  record it against the local backlog task.
  USE FOR: rough order of magnitude, ROM estimate, effort baseline, high-level sizing,
  generate rom.
  Reusable by BA and PM profiles.
---

# Generate ROM

## Backlog is Local (CRITICAL)

The ROM is recorded against the **repo-resident backlog** task in
`.setup-agents/state/tasks.jsonl` (via the local task / estimate commands), not Jira.
Atlassian MCP is optional (mirror-only).

## 1. What ROM Is

A ROM is a **coarse, order-of-magnitude** estimate for planning — not a commitment.
Use it to prioritize and to decide whether a story needs decomposition before a sprint.

## 2. T-shirt Sizing (human-effort baseline)

Size in **human-equivalent effort days** — what a developer would take by hand. This is the
baseline; the AI execution budget is measured separately from real runs, not derived here.

| Size | Human effort |
|------|--------------|
| XXS | trivial, < 4 hours |
| XS | half-day–1 day (4–8h) |
| S | 1–2 days |
| M | 3–5 days (≈ 1 week) |
| L | 6–8 days |
| XL | 9–11 days (≈ 1 sprint) |
| XXL | 12+ days — **split gate** |

- **XXL is not an estimate — it is a split gate.** Hand an XXL item to `decompose` before
  assigning any day value.

## 3. Method

- Estimate each refined story independently, then roll up to the epic.
- Record explicit **assumptions** and **exclusions** — a ROM without them is unusable.
- Present a range (low / expected / high) rather than a single number.
- Flag low-confidence estimates for further refinement before commitment.

## 4. Output

Produce a ROM table (Item | Size | Low | Expected | High | Assumptions) and record the
baseline against the local task so planning and prioritization can consume it.