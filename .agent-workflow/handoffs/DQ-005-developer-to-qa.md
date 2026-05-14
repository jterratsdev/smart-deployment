# Handoff DQ-005: developer to qa

- Status: ready_for_review
- Changed components: Wired DynamicQueryTargetValidator into StartExecutionService and added guard regression test.
- Behavior changed: Missing target-org fields produce an error listing consumer and required CustomField before deployment runner is called.
- Unit tests: tsc, focused eslint, focused unit tests, npm run build, npm test.
- Commands run: ./node_modules/.bin/tsc -p . --pretty false --incremental false; ./node_modules/.bin/eslint src/deployment/start-execution-service.ts test/unit/deployment/start-execution-dynamic-query-guard.test.ts; ./node_modules/.bin/nyc mocha test/unit/deployment/start-execution-dynamic-query-guard.test.ts test/unit/deployment/dynamic-query-target-validator.test.ts; npm run build; npm test
- Known gaps: none
- Risks: FieldDefinition lookup behavior should be smoke-tested against a real org before release.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- changed behavior
- commands run
- qa plan
- test evidence
