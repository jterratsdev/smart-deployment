# Handoff DQ-004: developer to qa

- Status: ready_for_review
- Changed components: Added DynamicQueryTargetValidator and SfCliMetadataLookup.
- Behavior changed: Validator reports missingFields only when target-org lookup says unresolved dynamic-query fields are absent.
- Unit tests: tsc, focused eslint, focused unit test, npm run build, npm test.
- Commands run: ./node_modules/.bin/tsc -p . --pretty false --incremental false; ./node_modules/.bin/eslint src/deployment/dynamic-query-target-validator.ts src/deployment/sf-cli-metadata-lookup.ts test/unit/deployment/dynamic-query-target-validator.test.ts; ./node_modules/.bin/nyc mocha test/unit/deployment/dynamic-query-target-validator.test.ts; npm run build; npm test
- Known gaps: none
- Risks: No deployment blocking behavior yet; DQ-005 owns integration and diagnostics.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- changed behavior
- commands run
- qa plan
- test evidence
