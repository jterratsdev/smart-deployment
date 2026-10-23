# Evidence SD-CUSTOM-LABELS-CONTAINER: command

- Role: developer
- Summary: Parent executed focused CustomLabels scanner and manifest tests: 15 passing; canonical file yields one node, other file ignored, normal manifest wildcard and destructive guard asserted. No live Salesforce deployment.
- Path: not applicable
- Command: yarn mocha test/unit/services/additional-metadata-scanner.test.ts test/unit/scanner/metadata-format-scanner.test.ts test/unit/deployment/wave-manifest-service.test.ts --reporter dot
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: exit status 0; output 15 passing; file generated manifest includes wildcard instead of label members; result one CustomLabels:CustomLabels container; destructive manifest throws
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
