# Handoff DQ-001: architect to developer

- Status: ready_for_review
- Changed components: Implement Apex dynamic SOQL extraction as parser-layer output; keep CLI and dependency graph untouched for this slice.
- Behavior changed: parseApexClass returns dynamicQueryReferences for Database.query, Database.getQueryLocator, and Search.query calls.
- Unit tests: Parser regression tests required.
- Commands run: ./node_modules/.bin/nyc mocha test/unit/parsers/apex-class-parser.test.ts
- Known gaps: none
- Risks: Only simple string literals, constants, and concatenations are high-confidence; unresolved expressions remain low-confidence for later graph validation.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- architecture decision
- scope
- code diff
- unit test results
