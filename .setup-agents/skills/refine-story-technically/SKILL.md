---
name: refine-story-technically
description: >-
  ADP Phase 2 — technical story refinement. Runs metadata impact analysis, applies NAMING,
  produces technical tasks, and updates the story in the local backlog.
  USE FOR: refine story technically, technical refinement, impact analysis, metadata graph,
  NAMING, technical tasking, ADP Phase 2.
  Used by the TA (Technical Architect) profile.
---

# Refine Story Technically (ADP Phase 2)

## Backlog is Local (CRITICAL)

Refined stories are stored in the **repo-resident backlog**, not an external tracker.
The source of truth is `.setup-agents/state/tasks.jsonl`.

- Persist every refined story with the local task command:
  ```bash
  sf setup-agents task create --id <ID> --summary "<title>" --role <role>
  ```
- Do **NOT** write stories to Jira as part of refinement. Atlassian MCP is **optional** —
  if it is configured you MAY mirror a story outward, but the local backlog remains authoritative.
- This trades against ADP's "agents never store stories in the repo" default on purpose:
  setup-agents keeps git as the source of truth.

## 1. Metadata Graph — Detect, then Fall Back (CRITICAL)

Impact analysis needs a metadata dependency graph. Resolve the provider in this order:

1. **Detect `sf-graphify`.** If the `sf-graphify` plugin is installed, use it:
   ```bash
   sf plugins inspect sf-graphify   # detection
   ```
   When present, use it for the dependency/impact graph.
2. **Fall back to the in-house `sf-metadata-index`** when `sf-graphify` is absent.
   This is the default, always-available path:
   ```bash
   sf setup-agents index            # builds .setup-agents/sf-metadata-index.json
   ```
   Then query impact via the setup-agents MCP metadata tools:
   - `dependency_graph` — transitive dependencies + dependents for a metadata entry.
   - `query_metadata` — a single entry with its dependencies/dependents (impact analysis).

Never assume `sf-graphify`; the fallback to `sf-metadata-index` / the MCP `impact_analysis`
(`dependency_graph` / `query_metadata`) tools is the guaranteed path.

## 2. Impact Analysis

- For each object/component the story touches, query the graph for **dependents** (what
  breaks if this changes) and **dependencies** (what must exist first).
- Flag sharing, async, and large-data-volume implications surfaced by the graph.
- Record impacted metadata as evidence so QA can target regression.

## 3. NAMING

Apply the naming convention to every new component before tasking:

- API Names: PascalCase; descriptions mandatory.
- Names must be consistent with the metadata graph — do not collide with existing entries
  returned by `query_metadata`.
- NAMING complements semantic commits; it governs component names, not just commit messages.

## 4. Technical Tasking

Break the refined story into technical tasks: impacted objects, sharing model, async
considerations, and test strategy. A story that is still too large is handed to `decompose`.

## 5. Persist to the Local Backlog

Update the story and its technical tasks via `sf setup-agents task create` /
the local task commands. Atlassian MCP mirroring stays optional.