# Static Analysis

Run and interpret local quality, type, dependency, secret, and security checks.

## When To Load

- Trigger: `lint`
- Trigger: `typecheck`
- Trigger: `secret`
- Trigger: `sast`
- Trigger: `precommit`
- Trigger: `dependency`
- Trigger: `scan`
- Trigger: `eslint`
- Trigger: `test`

## Procedure

- Inspect configured local checks before inventing commands.
- Run the smallest relevant check first, then the full gate before handoff or commit.
- Record command evidence and treat failed required checks as blockers unless explicitly deferred.

## Evidence

- `command`
- `report`
