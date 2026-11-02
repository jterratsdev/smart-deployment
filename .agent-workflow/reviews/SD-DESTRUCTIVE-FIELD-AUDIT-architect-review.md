# Review SD-DESTRUCTIVE-FIELD-AUDIT: architect

- Result: block
- Severity: info
- Findings: Automatic destructive-before-create sequencing for CustomField type or global value-set migrations is absent. Normal start never plans pre-destructive operations and explicit --destructive uses post-destructive changes; rollback-only two-phase delete/restore does not cover forward migrations. Linked external job bypasses plugin and validates --source-dir force-app without the PR's separate preDestructiveChanges.xml, producing two observed field errors. Deleting fields can lose data and break dependent flows/rules; org-specific prerequisites and exact rollback must be verified.
- Recommendation: Do not assume plugin or linked CI handles this migration. For this PR validate a reviewed, dependency-safe migration separately with explicit pre-destructive manifest, removing old references first and verifying deletion before creating dependent picklists/global value sets; require backup/approval and target-org validation. Product enhancement needs target-org semantic field comparison, safe transition classification and guarded pre-delete phase, not just reverse wave order.

## Return Action

- Return role: architect
- Return phase: architect
- Summary: Return to architect (architect) for correction before release can proceed.
- Required evidence: Complete the requested implementation correction, attach real command/file evidence, then record an approving review from the responsible role or QA before resuming release.
- Resume command: `orchestra workflow run --task SD-DESTRUCTIVE-FIELD-AUDIT --resume wfrun-1791582285327-ddf981`
