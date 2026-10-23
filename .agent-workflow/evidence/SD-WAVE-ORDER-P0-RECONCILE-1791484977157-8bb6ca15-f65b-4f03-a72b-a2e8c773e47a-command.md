# Evidence SD-WAVE-ORDER-P0-RECONCILE: command

- Role: developer
- Summary: Parent reran full test suite after selective P0 wave-order integration: 1691 passing, 2 pending; no failing tests. Focused waves/start tests 135 passing. yarn compile and yarn tsc -p ./test --pretty false passed; yarn lint passed with 47 pre-existing warnings and zero errors; git diff --check clean.
- Path: not applicable
- Command: yarn nyc mocha 'test/\*_/_.test.ts' --reporter dot
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: exit status 0; output 1691 passing and 2 pending; tests assert different-stage wave separation, unknown type rejection, hard cycle unplaced, merger dependency/stage boundary, and invalid execution plan rejected before creating clients
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
