# Evidence SD-WORKTREE-CLEANUP: command

- Role: developer
- Summary: Parent verifier passed: git worktree list --porcelain | rg -c '^worktree ' produced 1 after removing eight auxiliary worktrees; eight branch refs remain; prune dry-run produced no entries.
- Path: not applicable
- Command: git worktree list --porcelain | rg -c '^worktree '
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: Exit status 0; observable output is exactly 1, confirming the only registered worktree is the principal.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
