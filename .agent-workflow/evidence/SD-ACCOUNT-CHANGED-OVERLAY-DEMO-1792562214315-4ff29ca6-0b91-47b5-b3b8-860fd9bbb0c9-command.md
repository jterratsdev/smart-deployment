# Evidence SD-ACCOUNT-CHANGED-OVERLAY-DEMO: command

- Role: qa
- Summary: Parent-executed cmp of fresh baseline and restored Account XML returned exit code 0 with no output, confirming exact retrieved-byte equality after targeted restoration.
- Path: not applicable
- Command: cmp <(unzip -p .smart-deployment/account-changed-probe-baseline.zip unpackaged/objects/Account.object) <(unzip -p .smart-deployment/account-changed-probe-restored.zip unpackaged/objects/Account.object)
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: exit status: 0; observable output: no differences; effect: full restored object XML equals baseline byte-for-byte
- External validation: Read-only Metadata API retrievals 09Sak00000rGdZxEAK and 09Sak00000rGdzlEAC from cg-demo org 00Dak0000189OhPEAU; manual XML hash comparison and REST describe completed.
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
