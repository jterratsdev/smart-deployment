# Handoff DQ-002: architect to developer

- Status: ready_for_review
- Changed components: Use shared dynamic query reference helpers across Apex and CMDT parsers.
- Behavior changed: CustomMetadataRecord exposes dynamicQueryReferences for SOQL strings and object-plus-field-list configuration values.
- Unit tests: Custom metadata and Apex parser regression tests required.
- Commands run: ./node_modules/.bin/nyc mocha test/unit/parsers/apex-class-parser.test.ts test/unit/parsers/custom-metadata-parser.test.ts
- Known gaps: none
- Risks: Field-list detection is heuristic by configuration field name; graph integration should treat medium confidence differently from full SOQL.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- architecture decision
- scope
- code diff
- unit test results
