# Handoff DQ-003: architect to developer

- Status: ready_for_review
- Changed components: Route dynamic query field prerequisites through scanner dependencyDetails rather than parser or graph builder branching.
- Behavior changed: Apex and CMDT consumers gain hard CustomField:Object.Field dependency details while keeping existing declared dependencies.
- Unit tests: Service scanner tests plus dependency graph builder tests required.
- Commands run: ./node_modules/.bin/nyc mocha test/unit/services/code-metadata-scanner.test.ts test/unit/services/data-metadata-scanner.test.ts test/unit/dependencies/dependency-graph-builder.test.ts
- Known gaps: none
- Risks: If a CustomField node is absent from the scanned project, the edge is dangling until DQ-004 target-org validation determines whether the field already exists.
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- architecture decision
- scope
- code diff
- unit test results
