# Evidence SD-APEX-FALSE-EDGE-FIX: command

- Role: developer
- Summary: Parent-executed second slice (not committed): src/parsers/apex-class-dependencies.ts, apex-class-names.ts, apex-class-parser.ts, test/unit/parsers/apex-class-parser.test.ts. Read-only CDF plan before correction: 158 nodes, 2298 edges, 2230 unresolved, 104 unplaced, 294 unresolved edges from ApexClass. After correction: 158 nodes, 2086 edges, 2017 unresolved, 103 unplaced, 82 unresolved edges from ApexClass; CDF_AccountSetMembershipBatch no longer emits spurious ApexClass:c or RunSettings, remains unplaced due to three CustomField refs. Commands: npx mocha apex-class-parser + code-metadata-scanner + project-analysis-service: 45 passing; npx tsc -p test --noEmit --incremental false --pretty false pass; npx eslint touched paths pass; yarn build pass; sf plugins link . --no-install pass; sf smart-deployment --help pass; git diff --check pass. No org deploy or changes to external project sources; historical Orchestra health errors and unrelated dirty locks remain.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
