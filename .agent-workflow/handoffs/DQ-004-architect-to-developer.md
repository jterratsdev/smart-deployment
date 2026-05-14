# Handoff DQ-004: architect to developer

- Status: ready_for_review
- Changed components: Add target-org dynamic query validation as a deployment service with injected metadata lookup.
- Behavior changed: Unresolved dynamic-query CustomField edges can be checked against FieldDefinition when target org is available.
- Unit tests: Deployment service unit tests required.
- Commands run: ./node_modules/.bin/nyc mocha test/unit/deployment/dynamic-query-target-validator.test.ts
- Known gaps: none
- Risks: Service is not wired into start execution until DQ-005; sf lookup uses FieldDefinition and requires org/API permissions.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- architecture decision
- scope
- code diff
- unit test results
