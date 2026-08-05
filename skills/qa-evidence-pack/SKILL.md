# QA Evidence Pack

Build reviewable QA evidence packs that prove observable outcomes against
acceptance criteria without loading a large QA playbook into every task.

## When To Load

- Trigger: `qa evidence`
- Trigger: `test evidence`
- Trigger: `acceptance criteria coverage`
- Trigger: `playwright`
- Trigger: `e2e`
- Trigger: `screenshot`
- Trigger: `trace`
- Trigger: `video`
- Trigger: `visual diff`
- Trigger: `annotated screenshot`
- Trigger: `cli output`
- Trigger: `stdout`
- Trigger: `stderr`
- Trigger: `api contract`
- Trigger: `integration`
- Trigger: `webhook`

## Procedure

1. Identify the GitHub issue, user story, Orchestra task, and acceptance criteria.
2. Create or update a compact evidence report instead of pasting raw logs into
   the agent context.
3. Map every acceptance criterion to one of: automated, manual, contract/mock,
   external verification, deferred with owner and rationale.
4. Capture observable outcomes, not only command execution:
   - Web: visible state, key screenshots, Playwright trace, video for failures
     or critical flows, viewport/device.
   - CLI: command, exit code, stdout/stderr expectations, created/changed files,
     emitted events, final state.
   - API: request shape, response contract, error contract, idempotency when
     relevant, side effects.
   - Integration: sandbox/mock receiver result, webhook/event/log, correlation
     ID, database/query evidence, or explicit deferral.
   - Visual/UI/diagram: source or expected image, actual image, diff image when
     practical, annotated image for defects.
5. For visual bugs, create an annotated screenshot using concise overlays:
   - red rectangle for clipped, overlapping, or incorrect element bounds;
   - orange arrow for wrong connector, anchor, or flow direction;
   - yellow translucent area for excess whitespace or spacing defect;
   - blue guide line for expected alignment;
   - short label naming the defect.
6. Store large artifacts as files and reference paths from the report. Summarize
   only the relevant finding in the handoff.
7. Ask BA/Product to compare evidence against story and acceptance criteria, and
   Architect to review technical coverage before release.

## Evidence Report Template

```md
# QA Evidence Report

Task:
Issue/User Story:
Commit:
Environment:
Date:

## Acceptance Criteria Coverage

| AC  | Test | Result | Evidence | Notes |
| --- | ---- | ------ | -------- | ----- |

## Commands

| Command | Result | Output artifact |
| ------- | ------ | --------------- |

## Visual Evidence

| Viewport/Source | Actual | Expected/Source | Diff | Annotated | Result |
| --------------- | ------ | --------------- | ---- | --------- | ------ |

## External Verification

| System | Correlation ID | Evidence | Result |
| ------ | -------------- | -------- | ------ |

## Risks / Gaps

| Gap | Owner | PO accepted? | Rationale |
| --- | ----- | ------------ | --------- |
```

## Acceptance Rules

- A passing test without observable-result validation is not sufficient QA
  evidence.
- A report without acceptance-criteria mapping is incomplete for release.
- Visual defects need source/expected, actual, and annotated evidence unless the
  defect is already self-evident in a single screenshot.
- External integrations need receiver-side evidence or explicit deferral.
- Deferred evidence needs owner, rationale, follow-up, and Product Owner
  acceptance before release.

## Evidence

- `command`
- `file`
- `screenshot`
- `trace`
- `video`
- `log`
- `report`
