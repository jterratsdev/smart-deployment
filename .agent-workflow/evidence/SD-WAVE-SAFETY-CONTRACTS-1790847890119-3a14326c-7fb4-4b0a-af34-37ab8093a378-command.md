# Evidence SD-WAVE-SAFETY-CONTRACTS: command

- Role: developer
- Summary: Focused deployment-order assertions passed
- Path: not applicable
- Command: TS_NODE_PROJECT=test/tsconfig.json npx mocha test/unit/constants/deployment-order.test.ts test/unit/waves/wave-builder.test.ts test/unit/waves/wave-merger.test.ts test/unit/waves/wave-validator.test.ts test/unit/deployment/start-execution-service.test.ts
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: cli
- Assertions: Exit code: 0. Stdout: focused Mocha suite reports all tests passing. Stderr: only Node experimental/deprecation warnings, no test or compile error. Artifact references: changed source and tests under src/constants/deployment-order.ts, src/waves, src/deployment and test/unit. Final state: different stages are separate; unknowns, backward stages, executable cycles, malformed plans, unsafe merges, partial OWD plans, and mixed cycle remediation are blocked before mutation.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
