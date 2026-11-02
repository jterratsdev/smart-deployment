# Evidence SD-MATCH-DUP-LIVE-CG-DEMO: command

- Role: qa
- Summary: cg-demo full regression and check-only deployment evidence
- Path: not applicable
- Command: 13 batched retrieves; smart-deployment analyze/validate/start --dry-run; sf project deploy start --dry-run for DuplicateRule
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: cli
- Assertions: Exit code: all 13 retrieve batches 0; full analysis 0; full validation returns success false as designed; full start dry-run blocks before deploy; scoped plugin validation 0; Salesforce check-only 0. Stdout: 52,690 files reported, 48,510 files and 405 MB retrieved; 21,145 components scanned with 77,540 dependencies and zero scan errors; 18,916 placed and 2,229 blocked by two Apex cycles; scoped 4 DuplicateRule components form one valid wave; server check-only validates 4/4 with zero errors and changed=false. Stderr: Salesforce single-call 10,000-file limit required batching; no credential or customer metadata persisted in repository. Artifact references: OS temporary projects only and sanitized metrics. Final state: no org mutation occurred; real server-side deployment validation passed for all retrieved DuplicateRule components.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
