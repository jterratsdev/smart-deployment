# Proactive Orchestra

Self-bootstrap Open Orchestra workflow checks before implementation and record accepted bypasses.

## When To Load

- Trigger: `orchestra`
- Trigger: `workflow`
- Trigger: `task loop`
- Trigger: `bootstrap`
- Trigger: `pre-run`
- Trigger: `handoff`
- Trigger: `evidence`

## Procedure

- Run `orchestra health --json` and `orchestra task list --json` before implementation when `.agent-workflow/` exists.
- Resume pending, blocked, or in-progress work before creating a new task.
- Run `orchestra validate --pre-run --task <ID> --json` before implementation.
- Resolve missing estimate, workflow run, evidence, or review checks before marking work done.
- When the user accepts a smaller or advisory path, run `orchestra validate --pre-run --task <ID> --bypass --bypass-rationale "<reason>"` so the deviation is auditable.

## Evidence

- `command`
- `report`
- `file`
