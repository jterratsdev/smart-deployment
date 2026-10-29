# Evidence SD-RC-REMEDIATE: command

- Role: developer
- Summary: Final Yarn lock verifier
- Path: yarn.lock
- Command: yarn install --frozen-lockfile --ignore-scripts --network-timeout 600000; assert no Lockfile has incorrect entry
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: Assert exit status equals 0. Assert captured output has zero incorrect-entry warnings. Assert parser reports 1,499 records with version/resolved/integrity. Assert exact fast-uri 3.1.6, csv-parse 7.0.2, ip-address 10.2.0 selections.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
