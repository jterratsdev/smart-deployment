# Handoff DQ-002: developer to qa

- Status: ready_for_review
- Changed components: Added shared DynamicQueryReference helper and CMDT record extraction.
- Behavior changed: SOQL values emit high-confidence references; field-list configs emit medium confidence when paired with an object value.
- Unit tests: tsc, focused eslint, focused parser tests, npm run build, npm test.
- Commands run: ./node_modules/.bin/tsc -p . --pretty false --incremental false; ./node_modules/.bin/eslint src/parsers/apex-class-parser.ts src/parsers/apex-class-parser-model.ts src/parsers/apex-dynamic-query-analysis.ts src/parsers/dynamic-query-reference.ts src/parsers/custom-metadata-parser.ts test/unit/parsers/apex-class-parser.test.ts test/unit/parsers/custom-metadata-parser.test.ts; ./node_modules/.bin/nyc mocha test/unit/parsers/apex-class-parser.test.ts test/unit/parsers/custom-metadata-parser.test.ts; npm run build; npm test
- Known gaps: none
- Risks: No dependency graph edges are added in this slice; DQ-003 owns ordering semantics.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- changed behavior
- commands run
- qa plan
- test evidence
