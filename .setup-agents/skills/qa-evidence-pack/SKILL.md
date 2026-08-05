---
name: qa-evidence-pack
description: >-
  Build reviewable QA evidence packs that map acceptance criteria to observable
  outcomes, command results, screenshots, traces, videos, API contracts,
  integration side effects, and deferred evidence. USE FOR: qa evidence, test
  evidence, acceptance criteria coverage, playwright, e2e, screenshot, trace,
  video, visual diff, annotated screenshot, cli output, stdout, stderr, api
  contract, integration, webhook, release evidence.
---

# QA Evidence Pack

Use this skill when QA evidence must prove behavior, not just prove that a command ran.

## Procedure

1. Identify the backlog item, user story, task ID, personas, and acceptance criteria.
2. Create or update a compact evidence report instead of pasting raw logs into the chat.
3. Map every acceptance criterion to one of: automated, manual, contract/mock, external verification, or deferred with owner and rationale.
4. Capture observable outcomes:
   - Web: visible state, screenshots, Playwright trace, video for failures or critical flows, viewport/device.
   - CLI: command, exit code, stdout/stderr expectations, created/changed files, emitted events, final state.
   - API: request shape, response contract, error contract, idempotency when relevant, side effects.
   - Integration: sandbox/mock receiver result, webhook/event/log, correlation ID, database/query evidence, or explicit deferral.
   - Visual/UI/diagram: source or expected image, actual image, diff when practical, annotated image for defects.
5. For visual bugs, annotate the screenshot with concise overlays:
   - red rectangle for clipped, overlapping, or incorrect element bounds;
   - orange arrow for wrong connector, anchor, or flow direction;
   - yellow translucent area for excess whitespace or spacing defects;
   - blue guide line for expected alignment;
   - short label naming the defect.
6. Store large artifacts as files and reference paths from the report.
7. Ask BA/Product to compare evidence against the story and acceptance criteria, and Architect to review technical coverage before release.

## Generating test/coverage/lint evidence

Do NOT hand-roll a script to collect QA evidence — the plugin ships a generator that runs
the checks and records the results as `report` evidence on the task:

```bash
# Runs test (mocha), coverage (coverage/lcov.info), and lint (eslint) and records all three
sf setup-agents evidence generate --task <ID>

# Or one kind at a time
sf setup-agents evidence generate --task <ID> --kind coverage
```

These records feed the workflow QA gate and effort insights. Use `sf setup-agents evidence add`
for manual/visual/external artifacts that the generator cannot produce.

## Evidence Report Template

```md
# QA Evidence Report

Task:
Issue/User Story:
Commit:
Environment:
Date:

## Acceptance Criteria Coverage

| AC | Test | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |

## Commands

| Command | Result | Output artifact |
| --- | --- | --- |

## Visual Evidence

| Viewport/Source | Actual | Expected/Source | Diff | Annotated | Result |
| --- | --- | --- | --- | --- | --- |

## External Verification

| System | Correlation ID | Evidence | Result |
| --- | --- | --- | --- |

## Risks / Gaps

| Gap | Owner | Product accepted? | Rationale |
| --- | --- | --- | --- |
```

## Acceptance Rules

- A passing test without observable-result validation is not sufficient QA evidence.
- A report without acceptance-criteria mapping is incomplete for release.
- Visual defects need source/expected, actual, and annotated evidence unless the defect is self-evident in a single screenshot.
- External integrations need receiver-side evidence or explicit deferral.
- Deferred evidence needs owner, rationale, follow-up, and Product acceptance before release.