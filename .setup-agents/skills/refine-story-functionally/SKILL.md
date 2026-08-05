---
name: refine-story-functionally
description: >-
  ADP Phase 1 — functional story refinement. Runs discovery probes, applies the
  acceptance-criteria quality framework (INVEST + testable Gherkin), and records a
  refined, Ready story to the local backlog.
  USE FOR: refine story functionally, functional refinement, discovery probes,
  acceptance criteria quality, INVEST check, ADP Phase 1.
  Reusable by BA, SA, and TA profiles.
---

# Refine Story Functionally (ADP Phase 1)

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

## 1. Discovery Probes

Before writing any acceptance criteria, ask the probes that surface hidden requirements:

- **Who** is the persona and what is their goal? What is the value delivered?
- **What** is explicitly IN scope, and what is explicitly OUT of scope (non-goals)?
- **When / triggers** — what event starts this? What are the edge and error paths?
- **Data** — which objects/fields are read or written? Any PII or consent implications?
- **Assumptions & dependencies** — what must already exist? Which stories block this one?

Capture the answers; unanswered probes are gaps, not assumptions to invent.

## 2. Acceptance Criteria Quality Framework

Every AC must be **testable** and written in Gherkin (Given / When / Then):

```gherkin
Given <precondition>
When <action>
Then <observable, verifiable outcome>
```

| Quality gate | Rule |
|--------------|------|
| Independent | Story delivers value on its own; dependencies are declared, not hidden. |
| Negotiable | Captures the WHAT, not a locked-in HOW. |
| Valuable | Ties back to a persona goal / business value. |
| Estimable | Enough detail to size (hand to `generate-rom`). |
| Small | Fits one iteration; if not, hand to `decompose`. |
| Testable | Each AC has an observable outcome QA can verify. |

- Reject vague ACs ("works correctly", "is fast") — restate as observable outcomes.
- Every AC that touches PII must carry a Privacy AC (fields, legal basis, retention).

## 3. Ready Definition

A story is **Ready** only when: persona linked, scope + non-goals stated, ACs pass the
quality framework, data/objects listed, dependencies declared, and a sizing signal exists.
If any item is missing, the story is **Not Ready** — do not hand to technical refinement.

## 4. Persist to the Local Backlog

Record the refined story with `sf setup-agents task create` (see above). Include the
persona, Gherkin ACs, non-goals, and dependencies in the summary/goal so the technical
refinement phase and QA can consume them.

## 5. Handoff

A story sized M or larger, or one with technical unknowns, is handed to
`refine-story-technically` (TA) for impact analysis and technical tasking.