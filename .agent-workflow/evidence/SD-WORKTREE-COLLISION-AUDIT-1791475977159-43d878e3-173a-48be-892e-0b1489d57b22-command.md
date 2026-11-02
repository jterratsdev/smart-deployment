# Evidence SD-WORKTREE-COLLISION-AUDIT: command

- Role: developer
- Summary: Parent audited six conflict paths against source tar files, current reviews/handoffs and timestamped task events. The disposition file records chronology and preserves both sides without overwriting them. GH-252-FINAL-QA and GH-268 task status still blocked although later reviews approve scoped corrections; no gate or task status changed. jq confirms exactly six conflict paths; git diff --check passes.
- Path: not applicable
- Command: jq -e '.conflicts | length == 6' .agent-workflow/evidence/SD-WORKTREE-RECONCILE-import-report.json
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: Exit status 0; observable output true confirms six collided artifacts accounted for in SD-WORKTREE-COLLISION-AUDIT-disposition.md.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
