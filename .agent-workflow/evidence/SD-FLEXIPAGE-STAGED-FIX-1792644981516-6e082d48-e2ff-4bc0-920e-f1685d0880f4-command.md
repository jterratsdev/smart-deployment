# Evidence SD-FLEXIPAGE-STAGED-FIX: command

- Role: developer
- Summary: Parent-executed bounded diagnostic patch: plan explain CDF after npm run compile returned envelope status 0, result.success false, 13 stageConflicts including Tour -> CDF_Tour_Record_Page, source edge hard/parser/resolved, 0 waves and 1127 unplaced, 2502 unresolved; start --dry-run CDF still returned status 1 Deployment-order conflict without deploy. 40 focused tests passing; npx tsc --noEmit -p . and test/tsconfig, ESLint touched files, git diff --check passed. No CDF deploy or external source edits.
- Path: not applicable
- Command: npx mocha test/unit/analysis/project-analysis-service.test.ts test/unit/deployment/plan-explain-service.test.ts test/unit/presentation/plan-explain-presenter.test.ts test/unit/waves/wave-builder.test.ts
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: exit status 0; observable output 40 passing; effect: diagnostic plan retains edge and no executable waves; start still rejects
- External validation: Read-only CLI CDF plan explain and start dry-run shown above; no target-org observation for CDF.
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
