# Handoff DQ-003: developer to qa

- Status: ready_for_review
- Changed components: Added dynamic query dependency mapping and scanner integration for Apex/CMDT.
- Behavior changed: Graph builder receives structured hard edges for dynamic SOQL field prerequisites with confidence metadata.
- Unit tests: tsc, focused eslint, focused service/dependency tests, npm run build, npm test.
- Commands run: ./node_modules/.bin/tsc -p . --pretty false --incremental false; ./node_modules/.bin/eslint src/dependencies/dynamic-query-dependency-references.ts src/services/scanners/code-metadata-scanner.ts src/services/scanners/data-metadata-scanner.ts test/unit/services/code-metadata-scanner.test.ts test/unit/services/data-metadata-scanner.test.ts test/unit/dependencies/dependency-graph-builder.test.ts; ./node_modules/.bin/nyc mocha test/unit/services/code-metadata-scanner.test.ts test/unit/services/data-metadata-scanner.test.ts test/unit/dependencies/dependency-graph-builder.test.ts; npm run build; npm test
- Known gaps: none
- Risks: CustomField nodes are not created by this slice; absent field resolution is left to DQ-004.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- changed behavior
- commands run
- qa plan
- test evidence
