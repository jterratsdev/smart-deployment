# Handoff DQ-001: developer to qa

- Status: ready_for_review
- Changed components: Added DynamicQueryReference contract and extraction through parseApexClass.
- Behavior changed: Literal and simple concatenated SOQL now emits object, fields, raw query, origin, and confidence.
- Unit tests: tsc, focused eslint, parser test, npm run build, npm test.
- Commands run: ./node_modules/.bin/tsc -p . --pretty false --incremental false; ./node_modules/.bin/eslint src/parsers/apex-class-parser.ts src/parsers/apex-class-parser-model.ts src/parsers/apex-dynamic-query-analysis.ts test/unit/parsers/apex-class-parser.test.ts; ./node_modules/.bin/nyc mocha test/unit/parsers/apex-class-parser.test.ts; npm run build; npm test
- Known gaps: none
- Risks: Low-confidence entries intentionally avoid guessing dynamic fields.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- changed behavior
- commands run
- qa plan
- test evidence
