# Evidence SD-WORKTREE-RECONCILE: command

- Role: developer
- Summary: Archive reconciliation dry-run/replay verified: 30 missing tasks imported, 3 newer task snapshots selected, 402 events, 16 estimates and 69 workflow run snapshots merged; 85 missing files copied with archive and SHA-256 provenance. Six same-path conflicts retained in original archive without overwrite. jq task IDs unique, all ledgers parse; orchestra validate --json valid=true with warnings for inherited unknown historical run tasks, event types and two docs prompt entries. Repeated importer yielded same counts (idempotent). Product files untouched.
- Path: not applicable
- Command: node /var/folders/sj/9h61n9s102l90188chx01gk40000gp/T/opencode/reconcile-worktrees.mjs
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: Exit status 0; observable output reports tasksAdded=30 tasksUpdated=3 filesAdded=85 conflicts=6 and the report contains per-file hashes.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
