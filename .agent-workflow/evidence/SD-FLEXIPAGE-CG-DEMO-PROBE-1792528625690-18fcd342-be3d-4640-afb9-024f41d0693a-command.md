# Evidence SD-FLEXIPAGE-CG-DEMO-PROBE: command

- Role: qa
- Summary: Parent-run approved isolated cg-demo probe. Initial two fixture runs failed pre-omission and each fixture was verified absent; corrected run passed and cleanup independently verified. This does not prove standard-object or effective UI semantics.
- Path: not applicable
- Command: SMART_DEPLOYMENT_LIVE_FLEXIPAGE_OVERRIDE=1 SMART_DEPLOYMENT_LIVE_FLEXIPAGE_APPROVAL=I_APPROVE_CG_DEMO_FLEXIPAGE_CREATE_DELETE yarn mocha --require ts-node/register test/e2e/live-isolated-flexipage-override.e2e.test.ts
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: cli
- Assertions: exit code 0; stdout: 1 passing (2m), preservedAfterOmission true, temporary identity SD*FlexProbe_1577b59bff27\_\_c; stderr: only Node ExperimentalWarning and DEP0180 warning, no test error; artifact: test/e2e/live-isolated-flexipage-override.e2e.test.ts and docs/research/metadata-catalog/object-flexipage-activation-plan.md; final state: independent Tooling API queries for SD_FlexProbe*% EntityDefinition and FlexiPage returned records []
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
