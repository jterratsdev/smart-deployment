# Handoff DQ-005: architect to developer

- Status: ready_for_review
- Changed components: Place dynamic SOQL deployment guard in StartExecutionService before DeploymentRunner execution.
- Behavior changed: Real deployments fail fast with missing CustomField diagnostics; dry-run and validate-only remain skipped before the guard.
- Unit tests: Start execution guard unit test required.
- Commands run: ./node_modules/.bin/nyc mocha test/unit/deployment/start-execution-dynamic-query-guard.test.ts test/unit/deployment/dynamic-query-target-validator.test.ts
- Known gaps: none
- Risks: Cycle remediation path is not separately guarded before its runner; current guard is placed in the normal real deployment path.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- architecture decision
- scope
- code diff
- unit test results
