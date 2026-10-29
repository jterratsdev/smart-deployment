# Evidence SD-FLEXIPAGE-STAGED-FIX: command

- Role: developer
- Summary: Parent-run pure overlay prototype: npx mocha test/unit/deployment/object-flexipage-overlay.test.ts 3 passing, npx tsc --noEmit -p . and -p test/tsconfig.json passed, npx eslint touched overlay files passed, git diff --check passed. Read-only node ts-node/esm on CDF Tour XML: sourceBytes 9156, foundationBytes 8445, activationIdentical true, foundationPageRefs 0, activationPageRefs 2. No CDF writes or deploy; start/resume still blocked.
- Path: not applicable
- Command: npx mocha test/unit/deployment/object-flexipage-overlay.test.ts
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: exit status 0; observable output 3 passing; effect: pure overlay returns original activation and removes only selected source page overrides in foundation
- External validation: Read-only CDF Tour source check output documented; no org state asserted.
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
