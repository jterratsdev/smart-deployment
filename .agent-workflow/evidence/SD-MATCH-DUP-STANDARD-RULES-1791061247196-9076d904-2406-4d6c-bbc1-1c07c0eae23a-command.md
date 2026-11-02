# Evidence SD-MATCH-DUP-STANDARD-RULES: command

- Role: developer
- Summary: Standard matching-rule and dry-run safety fixes validated
- Path: not applicable
- Command: yarn compile; yarn lint; yarn test:only; full cg-demo snapshot analyze/start dry-run
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: cli
- Assertions: Exit code: compile/lint/tests 0; full snapshot analyze 0; full snapshot dry-run correctly blocked with exit 2. Stdout: 1,782 tests passing and 3 pending; empty standard MatchingRules containers omitted; full snapshot scanner completed with 21,145 components and zero scanner errors. Stderr: inherited lint warnings only; full snapshot dry-run reported two real Apex dependency cycles, not parser errors. Artifact references: synthetic scanner/FlexiPage/dry-run tests and sanitized live snapshot metrics. Final state: standard target-owned rules no longer create false local failures, structured FlexiPage values parse safely, and dry-run rejects incomplete plans before any deploy call.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
